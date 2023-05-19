import { ForwardedRef, Fragment, Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';

import {
  ActionIcon,
  Box,
  Button,
  Center,
  Divider,
  Flex,
  Group,
  Loader,
  Menu,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Title,
  Tooltip,
  Transition,
} from '@mantine/core';
import { IMAGE_MIME_TYPE } from '@mantine/dropzone';

import {
  ChevronsDown,
  Paperclip,
  Pencil, PencilPlus, Plus, Send,
} from 'tabler-icons-react';

import ActionButton from '@/lib/ui/components/ActionButton';
import MemberAvatar from '@/lib/ui/components/MemberAvatar';
import RichTextEditor, { toMarkdown } from '@/lib/ui/components/rte/RichTextEditor';


import config from '@/config';
import { getMembers } from '@/lib/db';
import {
  DomainWrapper,
  ExpandedMessageWithPing,
  MemberWrapper,
  MessagesWrapper,
  useApp,
  useChatStyles,
  useMember,
  useMessages,
  useSession,
} from '@/lib/hooks';
import { Member, Message } from '@/lib/types';
import { socket } from '@/lib/utility/realtime';

import moment from 'moment';
import { Editor } from '@tiptap/react';

import 'katex/dist/katex.min.css';
import 'highlight.js/styles/vs2015.css';

const AVATAR_SIZE = 36;
const MIN_IMAGE_WIDTH = 400;
const MIN_IMAGE_HEIGHT = 400;
const MAX_IMAGE_WIDTH = 600;
const MAX_IMAGE_HEIGHT = 1000;


////////////////////////////////////////////////////////////
type MessageGroupProps = {
  msgs: ExpandedMessageWithPing[];
  profile_id: string;
  style: string;
}

////////////////////////////////////////////////////////////
function MessageGroup({ msgs, style, ...props }: MessageGroupProps) {

  // Indicates if this group came from the user
  const fromUser = props.profile_id === msgs[0].sender?.id;

  // Check if any message within group has a ping targetted towrads reader
  const hasPing = useMemo<boolean>(() => {
    for (const m of msgs)
      if (m.pinged) return true;
    return false;
  }, [msgs]);


  return (
    <Flex wrap='nowrap' sx={(theme) => ({
      '&:hover': hasPing ? undefined : {
        '.msg-border': {
          background: theme.colors.indigo[5],
        },
      }
    })}>
      <Box className='msg-border' sx={(theme) => ({
        flexShrink: 0,
        width: 4,
        background:
          hasPing ? theme.fn.linearGradient(0, theme.colors.violet[5], theme.colors.pink[5]) :
            fromUser ? theme.colors.dark[5] : undefined,
        transition: 'background 0.08s',
        borderTopLeftRadius: 3,
        borderBottomLeftRadius: 3,
      })} />

      <Stack spacing={0} sx={{ flexGrow: 1 }}>
        {msgs.map((msg, i) => (
          <Group className='msg-body' align='start' noWrap sx={(theme) => ({
            padding: '0.2rem 0rem 0.2rem calc(1.2rem - 4px)',
            backgroundColor: hasPing ? '#2B293A' : undefined,
            transition: 'background-color 0.08s',

            '&:hover': {
              backgroundColor: hasPing ? '#312D46' : theme.colors.dark[6],
            },

            '&:first-child': { borderTopRightRadius: 3 },
            '&:last-child': { borderBottomRightRadius: 3 },
          })}>
            {i === 0 && (
              <MemberAvatar
                member={msg.sender}
                size={AVATAR_SIZE}
                sx={(theme) => ({
                  marginTop: '0.25rem',
                  backgroundColor: theme.colors.dark[5],
                })}
              />
            )}
            <Stack spacing={2} sx={(theme) => ({
              marginLeft: i !== 0 ? `calc(${AVATAR_SIZE}px + ${theme.spacing.md})` : undefined,
            })}>
              {i === 0 && (
                <Group align='end' spacing='xs'>
                  <Title order={6} sx={{ color: msg.sender?.color }}>
                    {msg.sender && typeof msg.sender !== 'string' ? msg.sender.alias : ''}
                  </Title>
                  <Text size='xs' color='dimmed'>{moment(msg.created_at).calendar(null, { lastWeek: 'dddd [at] LT' })}</Text>
                </Group>
              )}
              <div className={style} style={{ maxWidth: '80ch' }} dangerouslySetInnerHTML={{ __html: msg.message }} />
              {msg.attachments?.map((attachment, attachment_idx) => {
                if (attachment.type === 'image') {
                  if (!attachment.width || !attachment.height) return null;

                  // Determine if width or height should be filled
                  let w = 0, h = 0;
                  if (attachment.width > attachment.height) {
                    // Wide image, fill height
                    h = MIN_IMAGE_HEIGHT;
                    w = h * attachment.width / attachment.height;
                  }
                  else {
                    // Tall image, fill width
                    w = MIN_IMAGE_WIDTH;
                    h = w * attachment.height / attachment.width;
                  }

                  // Scale image down if too large
                  const scale = Math.min(MAX_IMAGE_WIDTH / w, MAX_IMAGE_HEIGHT / h);
                  if (scale < 1) {
                    w *= scale;
                    h *= scale;
                  }

                  return (
                    <Image
                      src={attachment.url}
                      alt={attachment.filename}
                      width={w}
                      height={h}
                      style={{ borderRadius: 6 }}
                    />
                  );
                }
              })}
            </Stack>
          </Group>
        ))}
      </Stack>
    </Flex>
  );
}


////////////////////////////////////////////////////////////
type MessagesViewportProps = {
  channel_id: string;
  domain: DomainWrapper;
  messages: MessagesWrapper;
  sender: MemberWrapper;
}

////////////////////////////////////////////////////////////
function MessagesViewport({ messages, ...props }: MessagesViewportProps) {
  const { classes } = useChatStyles();

  const viewport = useRef<HTMLDivElement>();

  const [showScrollBottom, setShowScrollBottom] = useState<boolean>(false);
  const [viewportSizeLagged, setViewportSizeLagged] = useState<number>(0);


  // Keep current position when new messages are added (doubles as setting scroll to bottom at beginning)
  useEffect(() => {
    if (!viewport.current) return;
    
    // Maintain constant distance from bottom
    const pos = viewportSizeLagged - viewport.current.scrollTop;
    viewport.current.scrollTo({
      top: viewport.current.scrollHeight - pos,
    });

    // Update viewport size
    setViewportSizeLagged(viewport.current.scrollHeight);
  }, [messages]);


  ////////////////////////////////////////////////////////////
  function scrollToBottom() {
    if (viewport.current) {
      viewport.current.scrollTo({
        top: viewport.current.scrollHeight,
      });
    }
  }


  ////////////////////////////////////////////////////////////
  return (
    <>
      <ScrollArea
        viewportRef={viewport as ForwardedRef<HTMLDivElement>}
        onScrollPositionChange={(e) => {
          if (!viewport.current) return;

          // Load more if approaching top
          if (e.y < config.app.ui.load_next_treshold)
            messages._next();

          // Show scroll to bottom button if getting far from bottom
          if (e.y < viewport.current.scrollHeight - viewport.current.clientHeight - 500) {
            if (!showScrollBottom)
              setShowScrollBottom(true);
          }
          else if (showScrollBottom)
            setShowScrollBottom(false);
        }}
        styles={{
          viewport: {
            padding: '0rem 1.2rem 0rem 0rem',
          }
        }}
      >
        <Stack spacing='sm'>
          {messages._exists && Object.entries(messages.data).map(([day, grouped], i) => (
            <Fragment>
              <Divider
                label={moment(day).format('LL')}
                labelPosition='center'
                sx={(theme) => ({ marginLeft: '1.2rem', color: theme.colors.dark[2] })}
              />
              {grouped.map((consec, j) => (
                <MessageGroup
                  msgs={consec}
                  profile_id={props.sender.id}
                  style={classes.typography}
                />
              ))}
            </Fragment>
          ))}

          <div style={{ height: '1.0rem' }} />
        </Stack>
      </ScrollArea>

      {showScrollBottom && (
        <ActionButton
          tooltip='Scroll To Bottom'
          tooltipProps={{ position: 'left', openDelay: 500 }}
          variant='filled'
          size='xl'
          radius='xl'
          sx={(theme) => ({
            position: 'absolute',
            bottom: '5.2rem',
            right: '1.4rem',
            backgroundColor: theme.colors.dark[8],
            '&:hover': {
              backgroundColor: theme.colors.dark[6],
            },
          })}
          onClick={scrollToBottom}
        >
          <ChevronsDown />
        </ActionButton>
      )}
    </>
  );
}


////////////////////////////////////////////////////////////
type MessagesViewProps = {
  channel_id: string;
  domain: DomainWrapper;
}

////////////////////////////////////////////////////////////
export default function MessagesView(props: MessagesViewProps) {
  const {
    channel_id,
    domain,
  } = props;

  // Data
  const app = useApp();
  const session = useSession();
  const sender = useMember(domain.id, session.profile_id);
  const messages = useMessages(props.channel_id, props.domain, sender);

  // States and refs
  const editorRef = useRef<Editor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lagged flag, used to delay rendering message viewport until after editor is rendered (takes 1 rotation for editor to show)
  const [lagged, setLagged] = useState<boolean>(false);

  const [attachments, setAttachments] = useState<File[]>([]);
  const [useFormattedEditor, setUseFormattedEditor] = useState<boolean>(false);

  // List of members that are typing
  const [typingMembers, setTypingMembers] = useState<Member[]>([]);
  // Used to store last member that was typing because transition takes a while to go off
  const [lastTyping, setLastTyping] = useState<Member | null>(null);


  // Refresh on stale data
  useEffect(() => {
    if (!app.general.stale[channel_id]) return;

    if (!messages._exists)
      // If a channel is stale, but data not even loaded, reset stale flag
      app._mutators.general.setStale(channel_id, false);

    else if (messages._exists) {
      // Refresh data and unset stale flag
      messages._refresh();
      app._mutators.general.setStale(channel_id, false);
    }
  }, []);

  // New message event
  useEffect(() => {
    function onNewMessage(domain_id: string, message: Message) {
      // Ignore if message isn't in this channel, it is handled by another handler
      if (!messages._exists || !sender._exists || message.channel !== props.channel_id) return;
  
      // Add message locally
      messages._mutators.addMessageLocal(message, sender);

      // Remove from typing list
      const idx = typingMembers.findIndex(m => m.id === message.sender);
      if (idx >= 0) {
        // Set list
        const copy = typingMembers.slice();
        copy.splice(idx, 1);
        setTypingMembers(copy);

        // Set last member
        if (copy.length === 1)
          setLastTyping(copy[0]);
      }
    }

    socket().on('chat:message', onNewMessage);

    return () => {
      socket().off('chat:message', onNewMessage);
    }
  }, [props.channel_id, messages, typingMembers]);

  // Displaying members that are typing
  useEffect(() => {
    function onChatTyping(profile_id: string, typing_channel_id: string, type: 'start' | 'stop') {
      // Only care about members in this channel
      if (typing_channel_id !== channel_id) return;

      // Index of member in list
      const ids = typingMembers.map(x => x.id);
      const idx = ids.findIndex(x => x === profile_id);
      
      // Different actions based on if user started or stopped
      if (type === 'start' && idx < 0) {
        ids.push(profile_id);

        // Fetch members
        getMembers(domain.id, ids, session).then((members) => {
          // Set list
          setTypingMembers(members);
          // Set last member
          if (members.length === 1)
            setLastTyping(members[0]);
        });
      }

      else if (type === 'stop' && idx >= 0) {
        // Set list
        const copy = typingMembers.slice();
        copy.splice(idx, 1);
        setTypingMembers(copy);

        // Set last member
        if (copy.length === 1)
          setLastTyping(copy[0]);
      }
    }

    socket().on('chat:typing', onChatTyping);

    return () => {
      socket().off('chat:typing', onChatTyping);
    };
  }, [typingMembers]);


  ////////////////////////////////////////////////////////////
  function onMessageSubmit() {
    const editor = editorRef.current;

    // console.log(channel_id, sender._exists, messages._exists, editor?.storage.characterCount.characters(), attachments.length)

    if (
      !channel_id ||
      !sender._exists ||
      !messages._exists ||
      !editor ||
      (!editor.storage.characterCount.characters() && !attachments.length)
    ) return;

    // Add message
    messages._mutators.addMessage(toMarkdown(editor), sender, attachments);

    // Clear input
    editor.commands.clearContent();
    setAttachments([]);

    // Reset to default input box
    setUseFormattedEditor(false);
  };

  // Lagged flag
  useEffect(() => {
    setLagged(true);
  }, []);


  return (
    <Box sx={(theme) => ({
      display: 'flex',
      position: 'relative',
      flexFlow: 'column',
      width: '100%',
      height: '100%',
      backgroundColor: theme.colors.dark[7],
    })}>
      {/* Work around to broken justify-content: flex-end */}
      <div style={{ flexGrow: 1 }} />
      {lagged && sender._exists && messages._exists && (
        <MessagesViewport
          channel_id={channel_id}
          domain={props.domain}
          messages={messages}
          sender={sender}
        />
      )}

      <Box sx={{
        position: 'relative',
        margin: '0rem 1.2rem 1.5rem 1.2rem',
      }}>
        <Transition mounted={typingMembers.length > 0} transition='slide-up' duration={200}>
          {(styles) => (
            <Group spacing='sm' sx={(theme) => ({
              position: 'absolute',
              top: '-1.5rem',
              padding: '1px 6px 1px 4px',
              backgroundColor: `${theme.colors.dark[7]}bb`,
              borderRadius: 3,
              zIndex: 0,
            })} style={styles}>
              <Loader variant='dots' size='xs' />
              <Text size='xs'>
                {typingMembers.length <= 1 && (
                  <><b>{lastTyping?.alias}</b> is typing...</>
                )}
                {typingMembers.length > 1 && typingMembers.length <= 4 && typingMembers.map((m, i) => (
                  <>
                    <b>{m.alias}</b>
                    {i === typingMembers.length - 2 ? ', and ' : i === typingMembers.length - 1 ? ' are typing...' : ', '}
                  </>
                ))}
                {typingMembers.length > 4 && 'Several people are typing...'}
              </Text>
            </Group>
          )}
        </Transition>

        <input
          ref={fileInputRef}
          type='file'
          accept={IMAGE_MIME_TYPE.join(',')}
          onChange={(event) => {
            // Add all chosen files
            if (event.target.files)
              setAttachments([...attachments, ...Array.from(event.target.files)]);
          }}
          style={{ display: 'none' }}
        />
        {props.domain._exists && (
          <RichTextEditor
            editorRef={editorRef}
            domain={props.domain}

            variant={useFormattedEditor ? 'full' : 'minimal'}
            placeholder='Message'
            markdown
            autofocus
            focusRing={false}
            maxCharacters={2048}
            maxHeight='40ch'

            attachments={attachments}
            onAttachmentsChange={setAttachments}

            rightSection={(
              <Group spacing={2} mr={useFormattedEditor ? 2 : 3}>
                <ActionButton
                  tooltip='Add Attachment'
                  tooltipProps={{ position: 'top-end', withArrow: true }}
                  variant='transparent'
                  sx={(theme) => ({ color: theme.colors.dark[1] })}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip size={useFormattedEditor ? 19 : 17} />
                </ActionButton>

                {useFormattedEditor ? (
                  <ActionButton
                    tooltip='Send'
                    tooltipProps={{ position: 'top-end', withArrow: true }}
                    variant='transparent'
                    onClick={onMessageSubmit}
                  >
                    <Send size={20} />
                  </ActionButton>
                ) : (
                  <ActionButton
                    tooltip='Formatted Message'
                    tooltipProps={{ position: 'top-end', withArrow: true }}
                    variant='transparent'
                    sx={(theme) => ({ color: theme.colors.dark[1] })}
                    onClick={() => setUseFormattedEditor(true)}
                  >
                    <PencilPlus size={18} />
                  </ActionButton>
                )}
              </Group>
            )}

            onSubmit={onMessageSubmit}
            onStartTyping={() => {
              socket().emit('chat:typing', session.profile_id, props.channel_id, 'start');
            }}
            onStopTyping={() => {
              socket().emit('chat:typing', session.profile_id, props.channel_id, 'stop');
            }}
          />
        )}
      </Box>
    </Box>
  );
}