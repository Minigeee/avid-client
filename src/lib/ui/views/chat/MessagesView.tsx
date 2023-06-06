import { ForwardedRef, Fragment, MutableRefObject, PropsWithChildren, Ref, RefObject, createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';

import {
  ActionIcon,
  Box,
  Button,
  Center,
  CloseButton,
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
  IconArrowForwardUp,
  IconChevronsDown,
  IconPaperclip,
  IconPencilPlus,
  IconSend,
} from '@tabler/icons-react';

import ActionButton from '@/lib/ui/components/ActionButton';
import { ContextMenu } from '@/lib/ui/components/ContextMenu';
import MemberAvatar from '@/lib/ui/components/MemberAvatar';
import RichTextEditor, { toMarkdown } from '@/lib/ui/components/rte/RichTextEditor';
import { MessageContextMenu } from './components/MessageMenu';


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
  useTimeout,
} from '@/lib/hooks';
import { ExpandedMessage, FileAttachment, Member, Message } from '@/lib/types';
import { socket } from '@/lib/utility/realtime';

import moment from 'moment';
import { Editor } from '@tiptap/react';

import 'katex/dist/katex.min.css';
import 'highlight.js/styles/vs2015.css';
import { useScrollIntoView } from '@mantine/hooks';

const AVATAR_SIZE = 38;
const MIN_IMAGE_WIDTH = 400;
const MIN_IMAGE_HEIGHT = 400;
const MAX_IMAGE_WIDTH = 600;
const MAX_IMAGE_HEIGHT = 1000;


////////////////////////////////////////////////////////////
type MessagesViewProps = {
  channel_id: string;
  domain: DomainWrapper;

  /** Side padding */
  p?: string;
  /** Bottom padding */
  pb?: string;
  /** Gap between pfp and message */
  avatarGap?: 'sm' | 'md' | 'lg';
}

/** Message viewport state */
type MessageViewState = {
  /** Current typing members */
  typing: Member[];
  /** Member that was typing last */
  last_typing: Member | null;
  /** Id of the message that is currently being edited */
  editing: string | null;
  /** The message the user is replying to */
  replying_to: ExpandedMessage | null;
  /** The id of the message to scroll to */
  scroll_to: string | null;
};

/** Message view context state, used to pass current state within message view */
export type MessageViewContextState = {
  /** Domain of the message channel */
  domain: DomainWrapper;
  /** Id of the message channel */
  channel_id: string;
  /** The sender member */
  sender: MemberWrapper<false>;
  /** Grouped messages */
  messages: MessagesWrapper<false>;

  /** Refs */
  refs: {
    /** Main editor ref */
    editor: RefObject<Editor>;
    /** Scroll area viewport ref */
    viewport: RefObject<HTMLDivElement>;
    /** Scroll to element ref */
    scroll_to: RefObject<HTMLDivElement>;
  },

  /** Message viewport state */
  state: MessageViewState & {
    /** State setter */
    _set: <K extends keyof MessageViewState>(key: K, value: MessageViewState[K]) => void;
    /** State setter for entire state */
    _setAll: (value: MessageViewState) => void;
  },

  /** Viewport style options */
  style: {
    /** Side padding */
    p: string;
    /** Bottom padding */
    pb: string;
    /** Gap between pfp and message */
    avatarGap: 'sm' | 'md' | 'lg';
  },
};

/** Message view context with loaded wrappers */
export type LoadedMessageViewContextState = Omit<MessageViewContextState, 'sender' | 'messages'> & {
  /** The sender member */
  sender: MemberWrapper;
  /** Grouped messages */
  messages: MessagesWrapper;
}

/** Message view context */
// @ts-ignore
export const MessageViewContext = createContext<MessageViewContextState>();

/** Message view context provider */
function useInitMessageViewContext({ domain, channel_id, ...props }: MessagesViewProps) {
  // Default styling
  const sidePadding = props.p || '2.0rem';
  const bottomPadding = props.pb || '1.8rem';
  const avatarGap = props.avatarGap || 'lg';

  // Data
  const app = useApp();
  const session = useSession();
  const sender = useMember(domain.id, session.profile_id);
  const messages = useMessages(channel_id, domain, sender);

  // Editor ref
  const editorRef = useRef<Editor>(null);
  // Scroll to
  const { scrollIntoView, targetRef, scrollableRef } = useScrollIntoView<HTMLDivElement>({
    duration: 500,
  });

  /** States */
	const [state, setState] = useState<MessageViewState>({
    typing: [],
    last_typing: null,
    editing: null,
    replying_to: null,
    scroll_to: null,
	});

  
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
      if (!messages._exists || message.channel !== channel_id) return;
  
      // Add message locally
      messages._mutators.addMessageLocal(message);

      // Remove from typing list
      const idx = state.typing.findIndex(m => m.id === message.sender);
      if (idx >= 0) {
        // Set list
        const copy = state.typing.slice();
        copy.splice(idx, 1);

        // Update state
        setState({
          ...state,
          typing: copy,
          last_typing: copy.length === 1 ? copy[0] : state.last_typing,
        });
      }
    }

    socket().on('chat:message', onNewMessage);

    return () => {
      socket().off('chat:message', onNewMessage);
    }
  }, [channel_id, messages, state.typing]);

  // Displaying members that are typing
  useEffect(() => {
    function onChatTyping(profile_id: string, typing_channel_id: string, type: 'start' | 'stop') {
      // Only care about members in this channel
      if (typing_channel_id !== channel_id) return;

      // Index of member in list
      const ids = state.typing.map(x => x.id);
      const idx = ids.findIndex(x => x === profile_id);
      
      // Different actions based on if user started or stopped
      if (type === 'start' && idx < 0) {
        ids.push(profile_id);

        // Fetch members
        getMembers(domain.id, ids, session).then((members) => {
          // Update state
          setState({
            ...state,
            typing: members,
            last_typing: members.length === 1 ? members[0] : state.last_typing,
          });
        });
      }

      else if (type === 'stop' && idx >= 0) {
        // Set list
        const copy = state.typing.slice();
        copy.splice(idx, 1);

        // Update state
        setState({
          ...state,
          typing: copy,
          last_typing: copy.length === 1 ? copy[0] : state.last_typing,
        });
      }
    }

    socket().on('chat:typing', onChatTyping);

    return () => {
      socket().off('chat:typing', onChatTyping);
    };
  }, [state.typing]);

  // Scroll to message
  useEffect(() => {
    if (!targetRef.current) return;
    scrollIntoView({ alignment: 'center' });
    setState({ ...state, scroll_to: null });
  }, [state.scroll_to]);


  return {
    domain,
    channel_id,
    sender,
    messages,

    refs: {
      editor: editorRef,
      viewport: scrollableRef,
      scroll_to: targetRef,
    },
    state: {
      ...state,
      _set: (key, value) => setState({ ...state, [key]: value }),
      _setAll: setState,
    },
    style: {
      p: sidePadding,
      pb: bottomPadding,
      avatarGap: avatarGap,
    }
  } as MessageViewContextState;
}

/** Use message view context */
function useMessageViewContext<Loaded extends boolean = false>() {
  return useContext(MessageViewContext) as Loaded extends true ? LoadedMessageViewContextState : MessageViewContextState;
}


////////////////////////////////////////////////////////////
type MessageEditorProps = {
  msg: ExpandedMessageWithPing;
}

////////////////////////////////////////////////////////////
function MessageEditor({ msg, ...props }: MessageEditorProps) {
  const context = useMessageViewContext<true>();

  const editorRef = useRef<Editor>(null);

  return (
    <Stack maw='80ch' spacing='xs'>
      <RichTextEditor
        editorRef={editorRef}
        domain={context.domain}
        value={msg.message}
        markdown
        autofocus

        onKey={(e) => {
          if (e.key === 'Escape') {
            context.state._set('editing', null);
            return true;
          }

          return false;
        }}
      />

      <Group spacing='xs' position='right'>
        <Button
          variant='default'
          onClick={() => context.state._set('editing', null)}
        >
          Cancel
        </Button>
        <Button
          variant='gradient'
          onClick={() => {
            if (!editorRef.current) return;

            // Edit message
            context.messages._mutators.editMessage(msg.id, toMarkdown(editorRef.current));
            // Close
            context.state._set('editing', null);
          }}
        >
          Save
        </Button>
      </Group>
    </Stack>
    );
}


////////////////////////////////////////////////////////////
type MessageGroupProps = {
  msgs: ExpandedMessageWithPing[];
  style: string;

  sender: MemberWrapper;
  editing: string | null;
  p: string;
  avatarGap: 'sm' | 'md' | 'lg';
  
  setState: MutableRefObject<<K extends keyof MessageViewState>(key: K, value: MessageViewState[K]) => void>;
  scrollToRef: RefObject<HTMLDivElement>;
  scrollTo: string | null;
}

////////////////////////////////////////////////////////////
function MessageGroup({ msgs, style, ...props }: MessageGroupProps) {
  // Don't use context bc it forces all groups to rerender (bad performance)
  // console.log('rerender msg')

  // Indicates if this group came from the user
  const fromUser = props.sender.id === msgs[0].sender?.id;

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
        borderTopLeftRadius: 4,
        borderBottomLeftRadius: 4,
      })} />

      <Stack spacing={0} sx={{ flexGrow: 1 }}>
        {msgs.map((msg, i) => (
          <ContextMenu.Trigger
            key={msg.id}
            ref={props.scrollTo && props.scrollTo === msg.id ? props.scrollToRef : undefined}
            className='msg-body'
            context={{ msg }}
            sx={(theme) => ({
              display: 'flex',
              gap: theme.spacing[props.avatarGap],

              padding: `0.25rem 0rem 0.25rem calc(${props.p} - 3px)`,
              backgroundColor: hasPing ? '#2B293A' : undefined,
              transition: 'background-color 0.08s',

              '&:hover': {
                backgroundColor: hasPing ? '#312D46' : theme.colors.dark[6],
              },

              '&:first-child': { borderTopRightRadius: 3 },
              '&:last-child': { borderBottomRightRadius: 3 },
            })}
          >
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

            <Stack spacing={6} sx={(theme) => ({ marginLeft: i !== 0 ? `calc(${AVATAR_SIZE}px + ${theme.spacing[props.avatarGap]})` : undefined })}>
              {props.editing !== msg.id && (
                <>
                  {i === 0 && (
                    <Group align='baseline' spacing={8}>
                      <Title order={6} sx={(theme) => ({ color: msg.sender?.alias === 'Minigee' ? theme.colors.blue[4] : undefined })}>
                        {msg.sender && typeof msg.sender !== 'string' ? msg.sender.alias : ''}
                      </Title>
                      <Text size={11} color='dimmed'>
                        {moment(msg.created_at).calendar(null, { lastWeek: 'dddd [at] LT' })}
                      </Text>
                    </Group>
                  )}

                  {msg.reply_to && (
                    <Group
                      spacing={6}
                      p='0.15rem 0.5rem 0.15rem 0.25rem'
                      h='1.5rem'
                      w='fit-content'
                      maw='80ch'
                      align='start'
                      sx={(theme) => ({
                        borderRadius: 3,
                        '&:hover': {
                          backgroundColor: theme.colors.dark[5],
                          cursor: 'pointer',
                        },
                      })}
                      onClick={() => {
                        props.setState.current?.('scroll_to', msg.reply_to?.id || null);
                      }}
                    >
                      <Box sx={(theme) => ({ color: theme.colors.dark[4] })}>
                        <IconArrowForwardUp size={20} style={{ marginTop: '0.15rem' }} />
                      </Box>
                      <MemberAvatar
                        member={msg.reply_to.sender}
                        size={20}
                      />
                      <Text
                        size={12}
                        weight={600}
                        sx={(theme) => ({ color: `${theme.colors.dark[0]}C0` })}
                      >
                        {msg.reply_to.sender?.alias}
                      </Text>
                      <Text
                        size={11}
                        mt={1}
                        mah='1.25rem'
                        sx={(theme) => ({
                          maxWidth: '80ch',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          color: `${theme.colors.dark[0]}C0`,
                        })}
                      >
                        {msg.reply_to.message.replace(/<\/?[^>]+(>|$)/g, ' ').replace(/<[^>]+>/g, '')}
                      </Text>
                    </Group>
                  )}
                  <div
                    className={style}
                    style={{ maxWidth: '80ch' }}
                    dangerouslySetInnerHTML={{ __html: msg.message }}
                  />
                  {msg.edited && (
                    <Text size={10} color='dimmed' mt={-6}>{'(edited)'}</Text>
                  )}
                </>
              )}
              {props.editing === msg.id && (
                <MessageEditor msg={msg} />
              )}

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
                    <ContextMenu.Trigger key={attachment.filename} context={{ msg, img: attachment.url }} sx={{ width: 'fit-content' }}>
                      <Image
                        key={attachment.filename}
                        src={attachment.url}
                        alt={attachment.filename}
                        width={w}
                        height={h}
                        style={{ borderRadius: 6 }}
                      />
                    </ContextMenu.Trigger>
                  );
                }
              })}
            </Stack>
          </ContextMenu.Trigger>
        ))}
      </Stack>
    </Flex>
  );
}

const MemoMessageGroup = memo(MessageGroup, (a, b) => {
  // Compare the user objects by their id property
  return a.style === b.style &&
    a.sender === b.sender &&
    a.editing === b.editing &&
    a.p === b.p &&
    a.scrollTo === b.scrollTo &&
    a.msgs.length === b.msgs.length && a.msgs.every((x, i) => x === b.msgs[i]);
});


////////////////////////////////////////////////////////////
type MessagesViewportProps = {
  showScrollBottom?: boolean;
  setShowScrollBottom?: (show: boolean) => void;
}

////////////////////////////////////////////////////////////
function MessagesViewport(props: MessagesViewportProps) {
  const context = useMessageViewContext();
  const { messages } = context;
  const { classes } = useChatStyles();

  // Lagged viewport size for scroll pos calculations
  const [viewportSizeLagged, setViewportSizeLagged] = useState<number>(0);

  // Update state ref to not activate memo rerender
  const setStateRef = useRef(context.state._set);
  useEffect(() => {
    setStateRef.current = context.state._set;
  }, [context.state._set]);


  // Calculate editing message to minimize memo component change
  const cachedProps = useMemo(() => {
    if (!messages._exists) return {};
    const map: Record<string, {
      editing: string | null;
      scrollTo: string | null;
    }> = {};

    for (const [day, groups] of Object.entries(messages.data)) {
      for (let i = 0; i < groups.length; ++i) {
        map[`${day}.${i}`] = {
          editing: context.state.editing && groups[i].findIndex(x => x.id === context.state.editing) >= 0 ? context.state.editing : null,
          scrollTo: context.state.scroll_to && groups[i].findIndex(x => x.id === context.state.scroll_to) >= 0 ? context.state.scroll_to : null,
        };
      }
    }

    return map;
  }, [messages, context.state]);

  // Keep current position when new messages are added (doubles as setting scroll to bottom at beginning)
  useEffect(() => {
    const viewport = context.refs.viewport.current;
    if (!viewport) return;
    
    // Maintain constant distance from bottom
    const pos = viewportSizeLagged - viewport.scrollTop;
    viewport.scrollTo({
      top: viewport.scrollHeight - pos,
    });

    // Update viewport size
    setViewportSizeLagged(viewport.scrollHeight);
  }, [messages]);


  // TODO : Show messages skeleton
  if (!context.sender._exists || !messages._exists) return null;

  ////////////////////////////////////////////////////////////
  return (
    <>
      <ScrollArea
        viewportRef={context.refs.viewport}
        onScrollPositionChange={(e) => {
          const viewport = context.refs.viewport.current;
          if (!viewport) return;

          // Load more if approaching top
          if (e.y < config.app.ui.load_next_treshold)
            messages._next();

          // Show scroll to bottom button if getting far from bottom
          if (e.y < viewport.scrollHeight - viewport.clientHeight - 500) {
            if (!props.showScrollBottom)
              props.setShowScrollBottom?.(true);
          }
          else if (props.showScrollBottom)
            props.setShowScrollBottom?.(false);
        }}
        styles={{
          viewport: {
            padding: `0rem ${context.style.p} 0rem 0rem`,
          }
        }}
      >
        <MessageContextMenu context={context as LoadedMessageViewContextState}>
          <Stack spacing='lg'>
            {messages._exists && Object.entries(messages.data).map(([day, grouped], i) => (
              <Fragment key={day}>
                <Divider
                  label={moment(day).format('LL')}
                  labelPosition='center'
                  sx={(theme) => ({ marginLeft: context.style.p, color: theme.colors.dark[2] })}
                />
                {grouped.map((consec, j) => (
                  <>
                    <MemoMessageGroup
                      key={j}
                      msgs={consec}
                      style={classes.typography}

                      sender={context.sender as MemberWrapper}
                      editing={cachedProps[`${day}.${j}`].editing}
                      p={context.style.p}
                      avatarGap={context.style.avatarGap}

                      setState={setStateRef}
                      scrollToRef={context.refs.scroll_to}
                      scrollTo={cachedProps[`${day}.${j}`].scrollTo}
                    />
                  </>
                ))}
              </Fragment>
            ))}

            <div style={{ height: '0.9rem' }} />
          </Stack>
        </MessageContextMenu>
      </ScrollArea>
    </>
  );
}


////////////////////////////////////////////////////////////
type TextEditorProps = {
  onSubmit: (message: string, attachments: FileAttachment[]) => boolean;
};

////////////////////////////////////////////////////////////
function TextEditor(props: TextEditorProps) {
  const context = useMessageViewContext();

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Indicates if formatted editor should be used
  const [useFormattedEditor, setUseFormattedEditor] = useState<boolean>(false);
  // List of file attachments
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);

  // Timeout object used to detect typing
  const typingTimeout = useTimeout(() => {
    if (context.sender._exists)
      socket().emit('chat:typing', context.sender.id, context.channel_id, 'stop');
  }, 2000);


  ////////////////////////////////////////////////////////////
  function onMessageSubmit() {
    const editor = context.refs.editor.current;

    // console.log(channel_id, sender._exists, messages._exists, editor?.storage.characterCount.characters(), attachments.length)

    if (
      !editor ||
      (!editor.storage.characterCount.characters() && !attachments.length)
    ) return;

    // Add message
    const handled = props.onSubmit(toMarkdown(editor), attachments)
    if (!handled) return;

    // Clear input
    editor.commands.clearContent();
    setAttachments([]);
    if (context.state.replying_to)
      context.state._set('replying_to', null);

    // Reset to default input box
    setUseFormattedEditor(false);

    // Reset typing timer
    typingTimeout.clear();
  };


  return (
    <RichTextEditor
      editorRef={context.refs.editor}
      domain={context.domain}

      variant={useFormattedEditor ? 'full' : 'minimal'}
      placeholder='Message'
      markdown
      autofocus
      focusRing={false}
      maxCharacters={2048}
      maxHeight='40ch'

      fileInputRef={fileInputRef}
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
            <IconPaperclip size={useFormattedEditor ? 19 : 17} />
          </ActionButton>

          {useFormattedEditor ? (
            <ActionButton
              tooltip='Send'
              tooltipProps={{ position: 'top-end', withArrow: true }}
              variant='transparent'
              onClick={onMessageSubmit}
            >
              <IconSend size={20} />
            </ActionButton>
          ) : (
            <ActionButton
              tooltip='Formatted Message'
              tooltipProps={{ position: 'top-end', withArrow: true }}
              variant='transparent'
              sx={(theme) => ({ color: theme.colors.dark[1] })}
              onClick={() => setUseFormattedEditor(true)}
            >
              <IconPencilPlus size={18} />
            </ActionButton>
          )}
        </Group>
      )}

      onSubmit={onMessageSubmit}

      typingTimeout={typingTimeout}
      onStartTyping={() => {
        if (context.sender._exists)
          socket().emit('chat:typing', context.sender.id, context.channel_id, 'start');
      }}
    />
  );
}


////////////////////////////////////////////////////////////
export default function MessagesView(props: MessagesViewProps) {
  // Data
  const context = useInitMessageViewContext(props);
  const { sender, messages } = context;

  // Determines if scroll to bottom button should be shown
  const [showScrollBottom, setShowScrollBottom] = useState<boolean>(false);

  // Lagged flag, used to delay rendering message viewport until after editor is rendered (takes 1 rotation for editor to show)
  const [lagged, setLagged] = useState<boolean>(false);


  // Calculate reply message text
  const replyToMsg = useMemo(() =>
    context.state.replying_to?.message.replace(/<\/?[^>]+(>|$)/g, ' ').replace(/<[^>]+>/g, ''),
    [context.state.replying_to]
  );

  // Lagged flag
  useEffect(() => {
    setLagged(true);
  }, []);


  ////////////////////////////////////////////////////////////
  function scrollToBottom() {
    if (context.refs.viewport.current) {
      context.refs.viewport.current.scrollTo({
        top: context.refs.viewport.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }

  return (
    <MessageViewContext.Provider value={context}>
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
            showScrollBottom={showScrollBottom}
            setShowScrollBottom={setShowScrollBottom}
          />
        )}

        <Box sx={{
          position: 'relative',
          margin: `0rem ${context.style.p} ${context.style.pb} ${context.style.p}`,
        }}>
          <Transition mounted={context.state.typing.length > 0} transition='slide-up' duration={200}>
            {(styles) => (
              <Group spacing={9} sx={(theme) => ({
                position: 'absolute',
                top: '-1.45rem',
                padding: '1px 0.5rem 1px 0.3rem',
                backgroundColor: `${theme.colors.dark[7]}bb`,
                borderRadius: 3,
                zIndex: 0,
              })} style={styles}>
                <Loader variant='dots' size='xs' />
                <Text size={11.5}>
                  {context.state.typing.length <= 1 && (
                    <><b>{context.state.last_typing?.alias}</b> is typing...</>
                  )}
                  {context.state.typing.length == 2 && (
                    <><b>{context.state.typing[0].alias}</b> and <b>{context.state.typing[1].alias}</b> are typing...</>
                  )}
                  {context.state.typing.length == 3 && (
                    <><b>{context.state.typing[0].alias}</b>, <b>{context.state.typing[1].alias}</b>, and <b>{context.state.typing[2].alias}</b> are typing...</>
                  )}
                  {context.state.typing.length > 3 && 'Several people are typing...'}
                </Text>
              </Group>
            )}
          </Transition>

          {showScrollBottom && (
            <ActionButton
              tooltip='Scroll To Bottom'
              tooltipProps={{ position: 'left', openDelay: 500 }}
              variant='filled'
              size='xl'
              radius='xl'
              sx={(theme) => ({
                position: 'absolute',
                top: '-3.75rem',
                right: '0.25rem',
                backgroundColor: theme.colors.dark[8],
                '&:hover': {
                  backgroundColor: theme.colors.dark[6],
                },
              })}
              onClick={scrollToBottom}
            >
              <IconChevronsDown />
            </ActionButton>
          )}

          {context.state.replying_to && (
            <Group
              h='1.75rem'
              p='0.15rem 0.5rem'
              spacing={6}
              align='start'
              sx={(theme) => ({
                backgroundColor: theme.colors.dark[8],
                borderTopLeftRadius: 3,
                borderTopRightRadius: 3,
              })}
            >
              <IconArrowForwardUp size={18} style={{ marginTop: '0.1rem' }} />
              <MemberAvatar
                member={context.state.replying_to.sender}
                size={20}
                sx={{ marginTop: '0.0625rem' }}
              />
              <Text
                size={12}
                weight={600}
                mt={2}
              >
                {context.state.replying_to.sender?.alias}
              </Text>
              <Text
                size={11}
                mt={3}
                mah='1.25rem'
                sx={{
                  maxWidth: '80ch',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {replyToMsg}
              </Text>

              <div style={{ flexGrow: 1 }} />
              <CloseButton
                size={'xs'}
                iconSize={15}
                mt={2}
                onClick={() => context.state._set('replying_to', null)}
              />
            </Group>
          )}

          <TextEditor
            onSubmit={(message, attachments) => {
              // If these don't exist, return false to indicate submit was not handled, don't clear input
              if (!messages._exists || !sender._exists)
                return false;

              // Send message
              messages._mutators.addMessage(message, sender, {
                attachments,
                reply_to: context.state.replying_to || undefined,
              });
              return true;
            }}
          />
        </Box>
      </Box>
    </MessageViewContext.Provider>
  );
}