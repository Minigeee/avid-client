import { ForwardedRef, Fragment, Ref, useEffect, useMemo, useRef, useState } from 'react';

import {
  ActionIcon,
  Box,
  Divider,
  Flex,
  Group,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core';

import {
  Pencil, PencilPlus, Send,
} from 'tabler-icons-react';

import MemberAvatar from '@/lib/ui/components/MemberAvatar';
import RichTextEditor, { toMarkdown } from '@/lib/ui/components/rte/RichTextEditor';

import moment from 'moment';
import { Editor } from '@tiptap/react';

import 'katex/dist/katex.min.css';
import 'highlight.js/styles/vs2015.css';


import {
  DomainWrapper,
  ExpandedMessageWithPing,
  MemberWrapper,
  useChatStyles,
  useMember,
  useMessages,
  useSession,
} from '@/lib/hooks';

const AVATAR_SIZE = 36;


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
            <Stack spacing={2} sx={(theme) => ({ marginLeft: i !== 0 ? `calc(${AVATAR_SIZE}px + ${theme.spacing.md})` : undefined })}>
              {i === 0 && (
                <Group align='end' spacing='xs'>
                  <Title order={6} sx={{ color: msg.sender?.color }}>
                    {msg.sender && typeof msg.sender !== 'string' ? msg.sender.alias : ''}
                  </Title>
                  <Text size='xs' color='dimmed'>{moment(msg.created_at).calendar(null, { lastWeek: 'dddd [at] LT' })}</Text>
                </Group>
              )}
              <div className={style} style={{ maxWidth: '80ch' }} dangerouslySetInnerHTML={{ __html: msg.message }} />
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
  sender: MemberWrapper;
}

////////////////////////////////////////////////////////////
function MessagesViewport(props: MessagesViewportProps) {
  const { classes } = useChatStyles();

  const messages = useMessages(props.channel_id, props.sender);

  const viewport = useRef<HTMLDivElement>();


  ////////////////////////////////////////////////////////////
  useEffect(() => {
    if (messages)
      scrollToBottom();
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
  /* TODO : function onNewMessage(result) {
    // Don't add message if sender is self
    for (const msg of result.messages) {
      if (msg.sender && msg.sender !== props.sender._id && messages._exists) {
        messages._update(addMessageLocal(messages.data || {}, msg, result), false);
      }
    }
  } */


  ////////////////////////////////////////////////////////////
  /* TODO : useEffect(() => {
    socket.on('chat:message', onNewMessage);
    return () => {
      socket.off('chat:message', onNewMessage);
    }
  }, [props.channel_id, messages]); */


  ////////////////////////////////////////////////////////////
  return (
    <ScrollArea
      viewportRef={viewport as ForwardedRef<HTMLDivElement>}
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

        <div style={{ height: '0.5rem' }} />
      </Stack>
    </ScrollArea>
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
  const session = useSession();
  const sender = useMember(domain.id, session.profile_id);
  const messages = useMessages(props.channel_id, sender);

  // States and refs
  const editorRef = useRef<Editor | null>(null);

  const [useFormattedEditor, setUseFormattedEditor] = useState<boolean>(false);


  ////////////////////////////////////////////////////////////
  function onMessageSubmit() {
    const editor = editorRef.current;
    if (!channel_id || !sender._exists || !editor?.storage.characterCount.characters() || !messages._exists) return;

    // Add message
    messages._mutators.addMessage(channel_id, toMarkdown(editor), sender);

    // Clear input
    editor.commands.clearContent();

    // Reset to default input box
    setUseFormattedEditor(false);
  }


  return (
    <Box sx={(theme) => ({
      display: 'flex',
      flexFlow: 'column',
      width: '100%',
      height: '100%',
      backgroundColor: theme.colors.dark[7],
    })}>
      {/* Work around to broken justify-content: flex-end */}
      <div style={{ flexGrow: 1 }} />
      {sender._exists && (
        <MessagesViewport
          channel_id={channel_id}
          domain={props.domain}
          sender={sender}
        />
      )}

      <Box sx={{
        margin: '0rem 1.2rem 1.5rem 1.2rem',
      }}>
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
            
            rightSection={useFormattedEditor ? (
              <Tooltip
                label='Send'
                position='top'
                withArrow
                openDelay={500}
                sx={(theme) => ({ backgroundColor: theme.colors.dark[9] })}
              >
                <ActionIcon
                  variant='transparent'
                  onClick={onMessageSubmit}
                  mr={2}
                >
                  <Send size={20} />
                </ActionIcon>
              </Tooltip>
            ) : (
              <Tooltip
                label='Formatted Message'
                position='top-end'
                withArrow
                sx={(theme) => ({ backgroundColor: theme.colors.dark[9] })}
              >
                <ActionIcon
                  variant='transparent'
                  mr={3}
                  sx={(theme) => ({ color: theme.colors.dark[1] })}
                  onClick={() => setUseFormattedEditor(true)}
                >
                  <PencilPlus size={18} />
                </ActionIcon>
              </Tooltip>
            )}

            onSubmit={onMessageSubmit}
          />
        )}
      </Box>
    </Box>
  );
}