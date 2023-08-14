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
  Popover,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Title,
  Tooltip,
  Transition,
  UnstyledButton,
} from '@mantine/core';
import { useScrollIntoView } from '@mantine/hooks';
import { IMAGE_MIME_TYPE } from '@mantine/dropzone';

import {
  IconArrowForwardUp,
  IconChevronsDown,
  IconMessages,
  IconMoodHappy,
  IconMoodPlus,
  IconPaperclip,
  IconPencilPlus,
  IconPin,
  IconSend,
  IconTool,
} from '@tabler/icons-react';

import { openAttachmentPreview } from '@/lib/ui/modals';
import ActionButton from '@/lib/ui/components/ActionButton';
import { ContextMenu } from '@/lib/ui/components/ContextMenu';
import { Emoji, EmojiPicker } from '@/lib/ui/components/Emoji';
import MemberAvatar from '@/lib/ui/components/MemberAvatar';
import RichTextEditor, { toMarkdown } from '@/lib/ui/components/rte/RichTextEditor';
import { MessageContextMenu } from './components/MessageMenu';
import MemberPopover from '../../components/MemberPopover';
import SidePanelView from './SidePanelView';


import config from '@/config';
import { api } from '@/lib/api';
import {
  DomainWrapper,
  ExpandedMessageWithPing,
  GroupedMessages,
  MemberWrapper,
  MessageMutators,
  MessagesWrapper,
  hasPermission,
  useApp,
  useChatStyles,
  useGroupedMessages,
  useMember,
  useMembers,
  useMessages,
  useSession,
  useTimeout,
} from '@/lib/hooks';
import { ExpandedMember, ExpandedMessage, FileAttachment, Member, Message, Role } from '@/lib/types';
import { socket } from '@/lib/utility/realtime';
import notification from '@/lib/utility/notification';

import moment from 'moment';
import { Editor } from '@tiptap/react';
import { motion } from 'framer-motion';

import 'katex/dist/katex.min.css';
import 'highlight.js/styles/vs2015.css';
import { throttle } from 'lodash';

const AVATAR_SIZE = 38;
const MIN_IMAGE_WIDTH = 400;
const MIN_IMAGE_HEIGHT = 400;
const MAX_IMAGE_WIDTH = 600;
const MAX_IMAGE_HEIGHT = 1000;


////////////////////////////////////////////////////////////
type MessagesViewProps = {
  channel_id: string;
  domain: DomainWrapper;
  /** Thread that should be shown in message view */
  thread_id?: string;
  /** Should the side panel be shown */
  withSidePanel?: boolean;
  /** Input box placeholder */
  placeholder?: string;

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
  /** The thread that should be viewed */
  view_thread: string | null;
  /** The thread that is currently being viewed */
  viewing_thread: string | null;
};

/** Message view context state, used to pass current state within message view */
export type MessageViewContextState = {
  /** Domain of the message channel */
  domain: DomainWrapper;
  /** Id of the message channel */
  channel_id: string;
  /** Thread that should be shown in message view */
  thread_id: string | undefined;
  /** The sender member */
  sender: MemberWrapper<false>;
  /** Raw messages */
  messages: MessagesWrapper<false>;
  /** Grouped messages */
  grouped: GroupedMessages;

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
    /** Indicates if side panel should be opened */
    withSidePanel: boolean;
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


// Tracks last typing (hack)
let _lastTyping: ExpandedMember | null = null;

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
  const messages = useMessages(channel_id, domain, { thread_id: props.thread_id });
  const groupedMessages = useGroupedMessages(messages.data || [], domain, sender);

  // Editor ref
  const editorRef = useRef<Editor>(null);
  // Scroll to
  const { scrollIntoView, targetRef, scrollableRef } = useScrollIntoView<HTMLDivElement>({
    duration: 500,
  });

  /** States */
	const [state, setState] = useState<Omit<MessageViewState, 'typing' | 'last_typing'>>({
    editing: null,
    replying_to: null,
    scroll_to: null,
    view_thread: null,
    viewing_thread: null,
	});

  const [typingIds, setTypingIds] = useState<string[]>([]);
  const typing = useMembers(domain.id, typingIds);
  const lastTyping = typing.data?.length ? typing.data[0] : _lastTyping;
  

  // Updates last typing
  useEffect(() => {
    if (typing._exists && typing.data.length > 0)
      _lastTyping = typing.data[0];
  }, [typing]);
  
  // Refresh on stale data
  useEffect(() => {
    if (!app.stale[channel_id]) return;

    // Refresh data
    if (messages._exists)
      messages._refresh();

    // Reset stale flag
    app._mutators.setStale(channel_id, false);
  }, []);

  // New message event
  useEffect(() => {
    // Skip if thread view
    if (props.thread_id) return;

    function onNewMessage(message: Message) {
      // Ignore if message isn't in this channel, it is handled by another handler
      if (!messages._exists || message.channel !== channel_id) return;
  
      // Add message locally
      messages._mutators.addMessageLocal(message);

      // Remove from typing list
      const idx = typingIds.findIndex(id => id === message.sender);
      if (idx >= 0) {
        // Set list
        const copy = typingIds.slice();
        copy.splice(idx, 1);
        setTypingIds(copy);
      }
    }

    socket().on('chat:message', onNewMessage);

    return () => {
      socket().off('chat:message', onNewMessage);
    }
  }, [channel_id, messages, typingIds]);

  // Edit message, delete message, reaction handler
  useEffect(() => {
    // Skip if thread view
    if (props.thread_id) return;

    function onEditMessage(edit_channel_id: string, message_id: string, message: Partial<Message>) {
      // Ignore if message isn't in this channel, it is handled by another handler
      if (!messages._exists || edit_channel_id !== channel_id) return;

      // Edit message locally
      messages._mutators.editMessageLocal(message_id, message);
    }

    function onDeleteMessage(edit_channel_id: string, message_id: string) {
      // Ignore if message isn't in this channel, it is handled by another handler
      if (!messages._exists || edit_channel_id !== channel_id) return;

      // Edit message locally
      messages._mutators.deleteMessageLocal(message_id);
    }

    function onReactionChanges(p_channel_id: string, message_id: string, changes: Record<string, number>, removeAll: boolean) {
      // Ignore if message isn't in this channel, it is handled by another handler
      if (!messages._exists || p_channel_id !== channel_id) return;
  
      // Apply changes locally
      messages._mutators.applyReactionChanges(message_id, changes, removeAll);
    }

    socket().on('chat:edit-message', onEditMessage);
    socket().on('chat:delete-message', onDeleteMessage);
    socket().on('chat:reactions', onReactionChanges);

    return () => {
      socket().off('chat:edit-message', onEditMessage);
      socket().off('chat:delete-message', onDeleteMessage);
      socket().off('chat:reactions', onReactionChanges);
    }
  }, [channel_id, messages]);

  // Displaying members that are typing
  useEffect(() => {
    // Skip if thread view
    if (props.thread_id) return;

    function onChatTyping(profile_id: string, typing_channel_id: string, type: 'start' | 'stop') {
      // Only care about members in this channel
      if (typing_channel_id !== channel_id) return;

      // Index of member in list
      const idx = typingIds.findIndex(x => x === profile_id);
      
      // Different actions based on if user started or stopped
      if (type === 'start' && idx < 0) {
        setTypingIds([...typingIds, profile_id]);
      }

      else if (type === 'stop' && idx >= 0) {
        // Set list
        const copy = typingIds.slice();
        copy.splice(idx, 1);
        setTypingIds(copy);
      }
    }

    socket().on('chat:typing', onChatTyping);

    return () => {
      socket().off('chat:typing', onChatTyping);
    };
  }, [typingIds]);

  // Scroll to message
  useEffect(() => {
    if (!targetRef.current) return;
    scrollIntoView({ alignment: 'center' });
    setState({ ...state, scroll_to: null });
  }, [state.scroll_to]);


  return {
    domain,
    channel_id,
    thread_id: props.thread_id,
    sender,
    messages,
    grouped: groupedMessages,

    refs: {
      editor: editorRef,
      viewport: scrollableRef,
      scroll_to: targetRef,
    },
    state: {
      ...state,
      typing: typing.data || [],
      last_typing: lastTyping,
      _set: (key, value) => setState({ ...state, [key]: value }),
      _setAll: setState,
    },
    style: {
      p: sidePadding,
      pb: bottomPadding,
      avatarGap: avatarGap,
      withSidePanel: props.withSidePanel !== false,
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
  domain: DomainWrapper;
  msgs: ExpandedMessageWithPing[];
  style: string;
  rolesMap: Record<string, Role & { index: number }>;

  sender: MemberWrapper;
  thread_id: string | undefined;
  viewing_thread: string | null;
  editing: string | null;
  p: string;
  avatarGap: 'sm' | 'md' | 'lg';
  
  setState: MutableRefObject<<K extends keyof MessageViewState>(key: K, value: MessageViewState[K]) => void>;
  scrollToRef: RefObject<HTMLDivElement>;
  scrollTo: string | null;

  canSendReactions: boolean;
  mutators: MutableRefObject<MessageMutators | null>;
}

////////////////////////////////////////////////////////////
type SingleMessageProps = Omit<MessageGroupProps, 'msgs'> & {
  msg: ExpandedMessageWithPing;
  hasPing: boolean;
  idx: number;
};

////////////////////////////////////////////////////////////
function SingleMessage({ msg, style, ...props }: SingleMessageProps) {
  const addReactionBtnRef = useRef<HTMLButtonElement>(null);

  // User's badges
  const badges = useMemo(() => {
    // Create list of role ids, sort by role order
    const roleIds: string[] = msg.sender?.roles?.slice() || [];
    roleIds.sort((a, b) => props.rolesMap[a] ? props.rolesMap[b] ? props.rolesMap[a].index - props.rolesMap[b].index : 1 : -1);

    const badges: JSX.Element[] = [];
    for (const id of roleIds) {
      const role = props.rolesMap[id];
      if (!role?.badge || role.show_badge === false) continue;

      badges.push(
        <Tooltip label={role.label} position='top-start' withArrow>
          <div style={{ cursor: 'default' }}><Emoji id={role.badge} size={14} /></div>
        </Tooltip>
      );
    }

    return badges;
  }, [msg.sender?.roles, props.rolesMap]);


  return (
    <ContextMenu.Trigger
      ref={props.scrollTo && props.scrollTo === msg.id ? props.scrollToRef : undefined}
      className='msg-body'
      context={{ msg }}
      sx={(theme) => ({
        display: 'flex',
        gap: 0,

        padding: `0.25rem 0rem 0.25rem calc(${props.p} - 4px)`,
        backgroundColor: props.hasPing ? '#2B293A' : props.viewing_thread === msg.thread?.id ? `${theme.colors.indigo[5]}10` : undefined,
        transition: 'background-color 0.08s',

        '&:hover': {
          backgroundColor: props.hasPing ? '#312D46' : props.viewing_thread === msg.thread?.id ? `${theme.colors.indigo[5]}1A` : theme.colors.dark[6],
        },

        '&:first-child': {
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
        },
        '&:last-child': {
          borderBottomLeftRadius: 3,
          borderBottomRightRadius: 3,
        },
      })}
    >
      {msg.sender && props.idx === 0 && (
        <MemberPopover member={msg.sender} domain={props.domain} withinPortal>
          <MemberAvatar
            member={msg.sender}
            size={AVATAR_SIZE}
            cursor='pointer'
            sx={(theme) => ({
              marginTop: '0.25rem',
              marginRight: theme.spacing[props.avatarGap],
              backgroundColor: theme.colors.dark[5],
            })}
          />
        </MemberPopover>
      )}

      <Stack spacing={6} sx={(theme) => ({
        flexGrow: 1,
        marginLeft: props.idx !== 0 ? `calc(${AVATAR_SIZE}px + ${theme.spacing[props.avatarGap]})` : undefined,
      })}>
        {props.editing !== msg.id && (
          <>
            {props.idx === 0 && (
              <div>
                <Group align='baseline' spacing={6}>

                  {msg.sender && typeof msg.sender !== 'string' && (
                    <MemberPopover member={msg.sender} domain={props.domain} withinPortal>
                      <Title order={6} color='gray' sx={{ cursor: 'pointer' }}>
                        {msg.sender.alias}
                      </Title>
                    </MemberPopover>
                  )}

                  {badges.length > 0 && (
                    <Group spacing={2} mb={2}>
                      {badges}
                    </Group>
                  )}

                  <Text size={11} color='dimmed' ml={2}>
                    {moment(msg.created_at).calendar(null, { lastWeek: 'dddd [at] LT' })}
                  </Text>
                </Group>
              </div>
            )}

            {(msg.reply_to || (msg.thread && props.thread_id !== '_')) && (
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
                  if (msg.reply_to)
                    props.setState.current?.('scroll_to', msg.reply_to.id || null);
                  else if (msg.thread)
                    props.setState.current?.('view_thread', msg.thread.id || null)
                }}
              >
                <Box sx={(theme) => ({ color: theme.colors.dark[4] })}>
                  <IconArrowForwardUp size={20} style={{ marginTop: '0.15rem' }} />
                </Box>

                {msg.reply_to && (
                  <>
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
                  </>
                )}
                {msg.thread && !msg.reply_to && (
                  <>
                    <Box sx={(theme) => ({ color: theme.colors.dark[2] })}>
                      <IconMessages size={16} />
                    </Box>
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
                      {msg.thread.name?.replace(/<\/?[^>]+(>|$)/g, ' ').replace(/<[^>]+>/g, '')}
                    </Text>
                  </>
                )}
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
              <ContextMenu.Trigger
                key={attachment.filename}
                context={{ msg, img: attachment.url }}
                sx={{ width: 'fit-content', cursor: 'pointer' }}
                onClick={() => openAttachmentPreview({ attachment })}
              >
                <Image
                  key={attachment.filename}
                  src={attachment.url}
                  alt={attachment.filename}
                  width={w}
                  height={h}
                  style={{ borderRadius: 6 }}
                  title={attachment.filename}
                />
              </ContextMenu.Trigger>
            );
          }
        })}

        {msg.reactions && msg.reactions.length > 0 && (
          <Group spacing={6} maw='80ch'>
            {msg.reactions.map((reaction) => (
              <Button
                key={reaction.emoji}
                variant='default'
                disabled={!props.canSendReactions && !reaction.self}
                p='0rem 0.4rem'
                h='1.5625rem'
                styles={reaction.self ? (theme) => ({
                  root: {
                    background: theme.fn.linearGradient(0, `${theme.colors.violet[9]}50`, `${theme.colors.violet[6]}50`),
                    border: `1px solid ${theme.colors.grape[8]}`,
                  }
                }) : undefined}
                onClick={() => {
                  if (reaction.self)
                    // Remove reaction
                    props.mutators.current?.removeReactions(msg.id, { emoji: reaction.emoji, self: true });
                  else
                    // Add reaction
                    props.mutators.current?.addReaction(msg.id, reaction.emoji);
                }}
              >
                <Group spacing={6} noWrap>
                  <Emoji id={reaction.emoji} size={14} />
                  <motion.div key={reaction.count} initial={{ y: -10 }} animate={{ y: 0 }}>
                    <Text span size='xs' weight={600} sx={(theme) => ({ color: theme.colors.dark[0] })}>{reaction.count}</Text>
                  </motion.div>
                </Group>
              </Button>
            ))}
            {props.canSendReactions && (
              <Popover position='right' withArrow>
                <Tooltip
                  label='Add reaction'
                  withArrow
                >
                  <Popover.Target>
                    <ActionIcon ref={addReactionBtnRef} variant='filled' size='1.5625rem' sx={(theme) => ({
                      backgroundColor: theme.colors.dark[5],
                      '&:hover': {
                        backgroundColor: theme.colors.dark[5],
                      },
                    })}>
                      <IconMoodPlus size='1rem' />
                    </ActionIcon>
                  </Popover.Target>
                </Tooltip>

                <Popover.Dropdown p='0.75rem 1rem' sx={(theme) => ({
                  backgroundColor: theme.colors.dark[7],
                  borderColor: theme.colors.dark[5],
                  boxShadow: '0px 4px 16px #00000030',
                })}>
                  <EmojiPicker
                    emojiSize={32}
                    onSelect={(emoji) => {
                      // Check if this emoji has already been used
                      const reaction = msg.reactions?.find(x => x.self && (x.emoji === emoji.id || x.emoji === emoji.skins[0].native))

                      // Add reaction
                      if (!reaction && emoji.skins.length > 0)
                        props.mutators.current?.addReaction(msg.id, emoji.id);

                      // Close menu
                      addReactionBtnRef.current?.click();
                    }}
                  />
                </Popover.Dropdown>
              </Popover>
            )}
          </Group>
        )}
      </Stack>

      {/* !props.thread_id && msg.thread && (
        <ActionButton
          tooltip='View Thread'
          tooltipProps={{ position: 'left' }}
          mr={4}
          sx={(theme) => ({
            color: theme.colors.dark[1],
            '&:hover': {
              backgroundColor: 'transparent',
              color: theme.colors.dark[0],
            }
          })}
          onClick={() => props.setState.current?.('view_thread', msg.thread || null)}
        >
          <IconMessages size={16} />
        </ActionButton>
      ) */}
      
      {msg.pinned && (
        <Box mr={8} mt={3} sx={(theme) => ({ color: theme.colors.green[7] })}>
          <IconPin size={16} />
        </Box>
      )}
    </ContextMenu.Trigger>
  );
}

////////////////////////////////////////////////////////////
function MessageGroup({ msgs, ...props }: MessageGroupProps) {
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
      position: 'relative',
      '&:hover': hasPing ? undefined : {
        '.msg-border': {
          background: theme.colors.indigo[5],
        },
      }
    })}>
      <Stack spacing={0} sx={{ flexGrow: 1 }}>
        {msgs.map((msg, i) => (
          <SingleMessage
            key={msg.id}
            idx={i}
            msg={msg}
            hasPing={hasPing}
            {...props}
          />
        ))}
      </Stack>

      <Box className='msg-border' sx={(theme) => ({
        position: 'absolute',
        flexShrink: 0,
        width: 4,
        height: '100%',
        background:
          hasPing ? theme.fn.linearGradient(0, theme.colors.violet[5], theme.colors.pink[5]) :
            fromUser ? theme.colors.dark[5] : undefined,
        transition: 'background 0.08s',
        borderTopLeftRadius: 4,
        borderBottomLeftRadius: 4,
      })} />
    </Flex>
  );
}

const MemoMessageGroup = memo(MessageGroup, (a, b) => {
  // Compare the user objects by their id property
  return a.style === b.style &&
    a.rolesMap === b.rolesMap &&
    a.sender === b.sender &&
    a.viewing_thread === b.viewing_thread &&
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
  const { messages, grouped } = context;
  const { classes } = useChatStyles();

  // Ref to message mutators, so messages can call latest mutators without rerendering each time
  const mutatorsRef = useRef<MessageMutators | null>(messages._exists ? messages._mutators : null);
  // Holds viewport position relative to bottom of chat, used to maintain (or not) the position of scroll when messages change
  const viewportPos = useRef<number>(0);
  // Indicates whether or not scroll pos should be maintained (relative to bottom of chat)
  const [maintainPos, setMaintainPos] = useState<boolean>(true);

  // Update state ref to not activate memo rerender
  const setStateRef = useRef(context.state._set);
  useEffect(() => {
    setStateRef.current = context.state._set;
  }, [context.state._set]);

  // Roles map for rendering badges
  const rolesMap = useMemo(() => {
    const map: Record<string, Role & { index: number }> = {};
    for (let i = 0; i < context.domain.roles.length; ++i) {
      const role = context.domain.roles[i];
      map[role.id] = { ...role, index: i };
    }
    return map;
  }, [context.domain.roles]);


  // Calculate editing message to minimize memo component change
  const cachedProps = useMemo(() => {
    if (!messages._exists) return {};
    const map: Record<string, {
      editing: string | null;
      scrollTo: string | null;
    }> = {};

    for (const [day, groups] of Object.entries(grouped)) {
      for (let i = 0; i < groups.length; ++i) {
        map[`${day}.${i}`] = {
          editing: context.state.editing && groups[i].findIndex(x => x.id === context.state.editing) >= 0 ? context.state.editing : null,
          scrollTo: context.state.scroll_to && groups[i].findIndex(x => x.id === context.state.scroll_to) >= 0 ? context.state.scroll_to : null,
        };
      }
    }

    return map;
  }, [messages, grouped, context.state]);

  // Keep current position when new messages are added (doubles as setting scroll to bottom at beginning)
  useEffect(() => {
    const viewport = context.refs.viewport.current;
    if (!viewport || !maintainPos) return;

    // Maintain position
    viewport.scrollTo({ top: viewport.scrollHeight - viewport.clientHeight - viewportPos.current });
  }, [messages, maintainPos]);

  // Called when scroll position changes
  const onScrollPosChange = throttle((e: { x: number; y: number }) => {
    const viewport = context.refs.viewport.current;
    if (!viewport || !messages._exists) return;

    // Update viewport pos
    viewportPos.current = viewport.scrollHeight - viewport.clientHeight - e.y;
    if (viewportPos.current < 100 && !maintainPos)
      setMaintainPos(true);
    else if (viewportPos.current >= 100 && maintainPos)
      setMaintainPos(false);

    // Load more if approaching top
    if (e.y < config.app.ui.load_next_treshold)
      messages._next();

    // Show scroll to bottom button if getting far from bottom
    if (e.y < viewport.scrollHeight - viewport.clientHeight - 100) {
      if (!props.showScrollBottom)
        props.setShowScrollBottom?.(true);
    }
    else if (props.showScrollBottom)
      props.setShowScrollBottom?.(false);
  }, 50, { leading: false });


  // Determines if user can send reactions
  const canSendReactions = hasPermission(context.domain, context.channel_id, 'can_send_reactions');

  // TODO : Show messages skeleton
  if (!context.sender._exists || !messages._exists) return null;

  ////////////////////////////////////////////////////////////
  return (
    <>
      <ScrollArea
        viewportRef={context.refs.viewport}
        onScrollPositionChange={onScrollPosChange}
        styles={{
          viewport: {
            padding: `0rem ${context.style.p} 0rem 0rem`,
          }
        }}
      >
        <MessageContextMenu context={context as LoadedMessageViewContextState}>
          <Stack spacing='lg'>
            {messages._exists && Object.entries(grouped).map(([day, grouped], i) => (
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
                      domain={context.domain}
                      msgs={consec}
                      style={classes.typography}
                      rolesMap={rolesMap}

                      sender={context.sender as MemberWrapper}
                      thread_id={context.style.withSidePanel ? context.thread_id : '_'}
                      viewing_thread={context.state.viewing_thread}
                      editing={cachedProps[`${day}.${j}`].editing}
                      p={context.style.p}
                      avatarGap={context.style.avatarGap}

                      setState={setStateRef}
                      scrollToRef={context.refs.scroll_to}
                      scrollTo={cachedProps[`${day}.${j}`].scrollTo}

                      canSendReactions={canSendReactions}
                      mutators={mutatorsRef}
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
  placeholder?: string;
  canSendAttachments: boolean;
  onSubmit: (message: string, attachments: FileAttachment[]) => boolean;
};

////////////////////////////////////////////////////////////
function TextEditor(props: TextEditorProps) {
  const session = useSession();
  const context = useMessageViewContext();

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Indicates if formatted editor should be used
  const [useFormattedEditor, setUseFormattedEditor] = useState<boolean>(false);
  // Indicates if emoji picker should be opened
  const [emojiPickerOpen, setEmojiPickerOpen] = useState<boolean>(false);
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
    const handled = props.onSubmit(toMarkdown(editor), props.canSendAttachments ? attachments : []);
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
      placeholder={props.placeholder || 'Message'}
      markdown
      autofocus
      focusRing={false}
      maxCharacters={2048}
      maxHeight='40ch'

      fileInputRef={fileInputRef}
      attachments={attachments}
      onAttachmentsChange={props.canSendAttachments ? setAttachments : () =>
        notification.info(
          'Attachment Permissions',
          'You do not have permissions to send attachments in this channel'
        )
      }

      rightSection={(
        <Group spacing={2} mr={useFormattedEditor ? 2 : 3}>
          {props.canSendAttachments && (
            <ActionButton
              tooltip='Add Attachment'
              tooltipProps={{ position: 'top-end', withArrow: true, withinPortal: !useFormattedEditor }}
              variant='transparent'
              sx={(theme) => ({ color: theme.colors.dark[1] })}
              onClick={() => fileInputRef.current?.click()}
            >
              <IconPaperclip size={useFormattedEditor ? 19 : 17} />
            </ActionButton>
          )}

          <Popover
            opened={emojiPickerOpen}
            withinPortal
            withArrow
            position='top-end'
            onClose={() => setEmojiPickerOpen(false)}
          >
            <Tooltip
              label='Emojis'
              position='top-end'
              withArrow
              withinPortal={!useFormattedEditor}
            >
              <Popover.Target>
                <ActionIcon
                  variant='transparent'
                  sx={(theme) => ({ color: theme.colors.dark[1] })}
                  onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
                >
                  <IconMoodHappy size={useFormattedEditor ? 20 : 18} />
                </ActionIcon>
              </Popover.Target>
            </Tooltip>
            <Popover.Dropdown p='0.75rem 1rem' sx={(theme) => ({
              backgroundColor: theme.colors.dark[7],
              borderColor: theme.colors.dark[5],
              boxShadow: '0px 4px 16px #00000030',
            })}>
              <EmojiPicker
                emojiSize={32}
                onSelect={(emoji) => {
                  const editor = context.refs.editor.current;
                  if (!editor) return;
                  
                  // Add emoji
                  editor.chain().focus().insertContent({
                    type: 'emojis',
                    attrs: {
                      'emoji-id': emoji.id,
                    },
                  }).insertContent({ type: 'text', text: ' ' }).run();

                  // Close picker
                  setEmojiPickerOpen(false);
                }}
              />
            </Popover.Dropdown>
          </Popover>

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
              tooltipProps={{ position: 'top-end', withArrow: true, withinPortal: !useFormattedEditor }}
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
      });
    }
  }

  return (
    <MessageViewContext.Provider value={context}>
      <Flex h='100%' align='stretch'>
        <Box sx={(theme) => ({
          flexGrow: 1,
          display: 'flex',
          position: 'relative',
          flexFlow: 'column',
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

            {hasPermission(props.domain, props.channel_id, 'can_send_messages') && (
              <TextEditor
                placeholder={props.placeholder}
                canSendAttachments={hasPermission(props.domain, props.channel_id, 'can_send_attachments')}
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
            )}
          </Box>
        </Box>

        {props.withSidePanel !== false && (
          <Box sx={(theme) => ({
            flexBasis: '25rem',
            height: '100%',
            /* position: 'relative',
            boxShadow: `0px 0px 6px ${theme.colors.dark[9]}`, */
            borderLeft: `1px solid ${theme.colors.dark[6]}`,
          })}>
            <SidePanelView
              channel_id={props.channel_id}
              domain={props.domain}
              context={context}
            />
          </Box>
        )}
      </Flex>
    </MessageViewContext.Provider>
  );
}