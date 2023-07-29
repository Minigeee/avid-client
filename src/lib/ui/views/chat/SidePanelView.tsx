import { MutableRefObject, forwardRef, memo, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';

import {
  ActionIcon,
  Box,
  Button,
  Center,
  CloseButton,
  Flex,
  Group,
  Popover,
  ScrollArea,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useElementSize } from '@mantine/hooks';
import { IconArrowForwardUp, IconMessages, IconPencil, IconPin } from '@tabler/icons-react';

import { openAttachmentPreview } from '@/lib/ui/modals';
import { useConfirmModal } from '@/lib/ui/modals/ConfirmModal';
import MessagesView, { LoadedMessageViewContextState, MessageViewContextState } from './MessagesView';
import MemberAvatar from '@/lib/ui/components/MemberAvatar';
import ActionButton from '@/lib/ui/components/ActionButton';
import { ContextMenu } from '@/lib/ui/components/ContextMenu';
import { Emoji } from '@/lib/ui/components/Emoji';
import RichTextEditor, { toMarkdown } from '@/lib/ui/components/rte/RichTextEditor';
import RoleBadges, { BadgeMap, useRoleBadges } from '@/lib/ui/components/RoleBadges';
import { MessageContextMenu } from './components/MessageMenu';

import { DomainWrapper, MessageMutators, getMemberSync, hasPermission, makeMarkdownEnv, renderMessage, useCachedState, useChatStyles, useMember, useMembers, useMessages, useSession, useThreads } from '@/lib/hooks';
import { ExpandedMember, ExpandedMessage, Member } from '@/lib/types';

import moment from 'moment';
import { Editor } from '@tiptap/react';
import { motion } from 'framer-motion';


////////////////////////////////////////////////////////////
interface ThreadItemProps extends React.ComponentPropsWithoutRef<'div'> {
  label: string;
  starter?: ExpandedMember;
  last_active: string;
}

////////////////////////////////////////////////////////////
const ThreadItem = forwardRef<HTMLDivElement, ThreadItemProps>(
  ({ label, last_active, starter, ...others }: ThreadItemProps, ref) => {
    return (
      <div ref={ref} {...others}>
        <Group noWrap>
          <div style={{ flexGrow: 1 }}>
            <Text weight={600}>{label}</Text>
            <Text size='xs' color='dimmed'>
              Last active: {moment(last_active).fromNow()}
            </Text>
          </div>

          <MemberAvatar member={starter} size={32} />
        </Group>
      </div>
    );
  }
);
ThreadItem.displayName = 'ThreadItem';


////////////////////////////////////////////////////////////
function ThreadsTab(props: SidePanelViewProps) {
  const session = useSession();
  
  const form = useForm({
    initialValues: { name: '' },
  });

  const [renaming, setRenaming] = useState<boolean>(false);

  const threads = useThreads(props.channel_id, props.domain);
  const [thread, setThread] = useState<string | null>(threads.data?.length ? threads.data[0].id : null);

  const threadStarterIds = useMemo(() => Array.from(new Set<string>(threads.data?.map(t => t.starters[0]) || [])), [threads.data]);
  const threadStarters = useMembers(props.domain.id, threadStarterIds);


  // Set initial thread
  useEffect(() => {
    if (!thread && threads._exists && threads.data.length > 0)
      setThread(threads.data[0].id);
  }, [threads._exists]);
  
  // Switch to threads view if view thread changes to non null
  useEffect(() => {
    if (props.context.state.view_thread) {
      setThread(props.context.state.view_thread);
      props.context.state._set('view_thread', null);
    }
  }, [props.context.state.view_thread]);

  // Thread select values
  const threadSelect = useMemo(() => {
    if (!threads._exists) return [];

    // Members
    const memberMap: Record<string, ExpandedMember> = {};
    for (const member of threadStarters.data || [])
      memberMap[member.id] = member;

    return threads.data.map(t => ({
      value: t.id,
      label: t.name,
      starter: memberMap[t.starters[0]],
      last_active: t.last_active,
    }));
  }, [threads.data, threadStarters.data]);

  // Determines if user can set thread name
  const canSetName = useMemo(() => {
    if (!threads._exists) return false;

    const t = threads.data.find(x => x.id === thread);
    return t?.starters.find(x => x === session.profile_id) !== undefined || hasPermission(props.domain, props.channel_id, 'can_manage');
  }, [threads.data, thread]);


  return (
    <>
      {!threads._exists || threads.data.length > 0 && (
        <Flex p='0.25rem 0.6rem' gap='0.5rem' align='end'>
          {!renaming && (
            <Select
              value={thread}
              onChange={setThread}
              placeholder={'Choose a thread'}
              icon={<IconMessages size={16} />}
              data={threadSelect}
              itemComponent={ThreadItem}
              sx={{ flexGrow: 1 }}
            />
          )}
          {renaming && (
            <form style={{ flexGrow: 1 }} onSubmit={form.onSubmit((values) => {
              // Rename channel
              if (thread)
                threads._mutators.setName(thread, values.name);
              // Go back to default view
              setRenaming(false);
            })}>
              <TextInput
                icon={<IconMessages size={16} />}
                styles={(theme) => ({
                  root: { flexGrow: 1 },
                  wrapper: { marginTop: 0 },
                })}
                {...form.getInputProps('name')}
                onFocus={(e) => e.target.select()}
                onBlur={() => setRenaming(false)}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape')
                    e.currentTarget.blur();
                }}
                autoFocus
              />
            </form>
          )}

          {!renaming && canSetName && (
            <ActionButton
              tooltip='Rename'
              size='lg'
              mb={2}
              hoverBg={(theme) => theme.colors.dark[6]}
              onClick={() => {
                form.setFieldValue('name', threadSelect.find(x => x.value === thread)?.label || '');
                setRenaming(true);
              }}
            >
              <IconPencil size={22} />
            </ActionButton>
          )}
        </Flex>
      )}

      {thread && (
        <Box sx={{ flexGrow: 1, height: 0 }}>
          <MessagesView
            channel_id={props.channel_id}
            thread_id={thread}
            domain={props.domain}
            p='1.2rem'
            pb='1.8rem'
            avatarGap='md'
            withSidePanel={false}
            placeholder='Reply to thread'
          />
        </Box>
      )}
      {!thread && (
        <Center h='10rem'>
          <div>
            <Text color='dimmed' align='center'>
              {threads._exists && threads.data.length === 0 ? 'This channel has no threads' : 'No thread is selected'}
            </Text>
            {threads._exists && threads.data.length === 0 && (
              <Text color='dimmed' size='sm'>
                {'(Reply to a message to start a new thread)'}
              </Text>
            )}
          </div>
        </Center>
      )}
    </>
  );
}


////////////////////////////////////////////////////////////
type MessageEditorProps = {
  domain: DomainWrapper;
  msg: ExpandedMessage;
  onEdit: (message: string) => void;
  onCancel: () => void;
}

////////////////////////////////////////////////////////////
function MessageEditor({ msg, ...props }: MessageEditorProps) {
  const editorRef = useRef<Editor>(null);

  return (
    <Stack maw='80ch' spacing='xs'>
      <RichTextEditor
        editorRef={editorRef}
        domain={props.domain}
        value={msg.message}
        markdown
        autofocus

        onKey={(e) => {
          if (e.key === 'Escape') {
            props.onCancel();
            return true;
          }

          return false;
        }}
      />

      <Group spacing='xs' position='right'>
        <Button
          variant='default'
          onClick={props.onCancel}
        >
          Cancel
        </Button>
        <Button
          variant='gradient'
          onClick={() => {
            if (!editorRef.current) return;

            // Edit message
            props.onEdit(toMarkdown(editorRef.current));
          }}
        >
          Save
        </Button>
      </Group>
    </Stack>
    );
}


////////////////////////////////////////////////////////////
type PinnedMessageProps = {
  domain: DomainWrapper;
  style: string;
  badges: BadgeMap;
  msg: ExpandedMessage;
  
  mutators: MutableRefObject<MessageMutators | null>;
  editing: string | null;
  setEditing: (value: string | null) => void;

  canPinMessages: boolean;
  canSendReactions: boolean;
};

////////////////////////////////////////////////////////////
function PinnedMessage({ msg, ...props }: PinnedMessageProps) {
  console.log('rerender')

  const { open: openConfirmModal } = useConfirmModal();

  const { ref, width } = useElementSize();
  // Lagged state to reactivate attachments
  const [trigger, setTrigger] = useState<boolean>(false);

  // File attachments
  const attachments = useMemo(() => {
    if (!ref.current) {
      return [];
    }

    const MAX_IMAGE_WIDTH = width;
    const MAX_IMAGE_HEIGHT = 800;

    return msg.attachments?.map((attachment, attachment_idx) => {
      if (attachment.type === 'image') {
        if (!attachment.width || !attachment.height) return null;

        // Fill width
        let w = 0, h = 0;
        w = MAX_IMAGE_WIDTH;
        h = w * attachment.height / attachment.width;

        // Scale image down if too large
        const scale = Math.min(MAX_IMAGE_WIDTH / w, MAX_IMAGE_HEIGHT / h);
        if (scale < 1) {
          w *= scale;
          h *= scale;
        }

        return (
          <ContextMenu.Trigger
            key={attachment.filename}
            context={{ msg, img: attachment.url, onEdit: (msg_id: string) => props.setEditing(msg_id) }}
            sx={{ width: 'fit-content', cursor: 'pointer' }}
            onClick={() => openAttachmentPreview({ attachment })}
          >
            <Image
              key={attachment.filename}
              src={attachment.url}
              alt={attachment.filename}
              width={w}
              height={h}
              style={{ borderRadius: 4 }}
              title={attachment.filename}
            />
          </ContextMenu.Trigger>
        );
      }
    }) || null;
  }, [msg, trigger]);

  // Hack but it works so
  useEffect(() => {
    if (msg.attachments?.length && width <= 0)
      setTrigger(!trigger);
  }, [trigger]);


  return (
    <ContextMenu.Trigger
      context={{ msg, onEdit: (msg_id: string) => props.setEditing(msg_id) }}
      sx={(theme) => ({
        display: 'flex',
        flexDirection: 'column',
        padding: '0.8rem 1.0rem',
        gap: '0.5rem',

        backgroundColor: theme.colors.dark[6],
        borderRadius: theme.radius.sm,
        boxShadow: '0px 0px 12px #00000030',
      })}
    >
      <Group ref={ref} spacing='sm' w='100%' mb={6}>
        <MemberAvatar
          member={msg.sender}
          size={38}
          sx={(theme) => ({
            marginTop: '0.25rem',
            backgroundColor: theme.colors.dark[5],
          })}
        />

        <Box mt={2} sx={{ flexGrow: 1 }}>
          <Group spacing={6}>
            <Title order={6} color='gray'>
              {msg.sender && typeof msg.sender !== 'string' ? msg.sender.alias : ''}
            </Title>

            <RoleBadges badges={props.badges} role_ids={msg.sender?.roles || []} />
          </Group>

          <Text size={11} color='dimmed' ml={2}>
            {moment(msg.created_at).calendar(null, { lastWeek: 'dddd [at] LT' })}
          </Text>
        </Box>

        {props.canPinMessages && (
          <CloseButton
            size='sm'
            iconSize={18}
            mt={2}
            sx={{ alignSelf: 'start' }}
            onClick={() => {
              openConfirmModal({
                title: 'Unpin Message',
                content: (
                  <Text>Are you sure you want to unpin this message?</Text>
                ),
                confirmLabel: 'Unpin',
                onConfirm: () => {
                  props.mutators.current?.unpinMessage(msg.id);
                },
              });
            }}
          />
        )}
      </Group>

      {props.editing !== msg.id && (
        <>
          <div
            className={props.style}
            style={{ maxWidth: '80ch' }}
            dangerouslySetInnerHTML={{ __html: msg.message }}
          />
          {msg.edited && (
            <Text size={10} color='dimmed' mt={-6}>{'(edited)'}</Text>
          )}
        </>
      )}
      {props.editing === msg.id && (
        <MessageEditor
          domain={props.domain}
          msg={msg}
          onEdit={(message) => {
            props.mutators.current?.editMessage(msg.id, message);
            props.setEditing(null);
          }}
          onCancel={() => props.setEditing(null)}
        />
      )}

      {attachments}

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
        </Group>
      )}
    </ContextMenu.Trigger>
  );
}
const MemoPinnedMessage = memo(PinnedMessage, (a, b) => {
  // Compare the user objects by their id property
  return a.style === b.style &&
    a.msg === b.msg &&
    (a.editing === a.msg.id) === (b.editing === b.msg.id) &&
    a.domain === b.domain &&
    a.badges === b.badges;
});

////////////////////////////////////////////////////////////
function PinnedTab(props: SidePanelViewProps) {
  const { classes } = useChatStyles();
  
  // Ref to message mutators, so messages can call latest mutators without rerendering each time
  const mutatorsRef = useRef<MessageMutators | null>(props.context.messages._exists ? props.context.messages._mutators : null);
  if (!mutatorsRef.current && props.context.messages._exists)
    mutatorsRef.current = props.context.messages._mutators;

  // Message currently being edited
  const [editing, setEditing] = useState<string | null>(null);

  // Raw messages
  const messages = useMessages(props.channel_id, props.domain.id, { pinned: true });
  // Badges
  const badges = useRoleBadges(props.domain);


  // Custom context
  const context = useMemo(() => messages._exists ? ({ ...props.context, messages }) : props.context, [props.context, messages]);

  // Rendered messages
  const rendered = useMemo(() => {
    if (!messages._exists) return [];

    // Create md env
    const env = makeMarkdownEnv(props.domain);

    return messages.data.map(m => ({
      ...m,
      message: renderMessage(m.message, env),
      sender: m.sender ? getMemberSync(props.domain.id, m.sender) : null,
      reply_to: undefined,
    })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [messages.data, props.domain.roles]);
  
  // Determines if user can send reactions
  const canSendReactions = hasPermission(props.domain, props.channel_id, 'can_send_reactions');
  const canPinMessages = hasPermission(props.domain, props.channel_id, 'can_manage_messages');


  return (
    <ScrollArea h='100%'>
      <MessageContextMenu context={context as LoadedMessageViewContextState}>
        <Stack p='0.5rem' spacing='sm'>
          {rendered.map((msg) => (
            <MemoPinnedMessage
              domain={props.domain}
              style={classes.typography}
              badges={badges}
              msg={msg}

              mutators={mutatorsRef}
              editing={editing}
              setEditing={setEditing}

              canPinMessages={canPinMessages}
              canSendReactions={canSendReactions}
            />
          ))}
        </Stack>
      </MessageContextMenu>

      {messages._exists && messages.data.length === 0 && (
        <Center h='10rem'>
          <Text color='dimmed'>
            This channel has no pinned messages
          </Text>
        </Center>
      )}
    </ScrollArea>
  );
}


////////////////////////////////////////////////////////////
type SidePanelViewProps = {
  channel_id: string;
  domain: DomainWrapper;
  context: MessageViewContextState;
}

////////////////////////////////////////////////////////////
export default function SidePanelView(props: SidePanelViewProps) {
  const [tab, setTab] = useCachedState<string | null>(`${props.channel_id}.side_tab`, 'pinned');

  // Switch to threads view if view thread changes to non null
  useEffect(() => {
    if (props.context.state.view_thread)
      setTab('threads');
  }, [props.context.state.view_thread]);


  return (
    <Tabs
      value={tab}
      onTabChange={setTab}
      variant='pills'
      color='dark'
      keepMounted={false}
      styles={(theme) => ({
        root: { height: '100%' },
        tabsList: {
          height: '2.9rem',
          alignItems: 'center',
          paddingTop: '0.2rem',
          paddingLeft: '0.3rem',
          borderBottom: `1px solid ${theme.colors.dark[6]}`
        },
        tab: {
          color: theme.colors.dark[1],
          fontWeight: 600,
          transition: 'background-color 0.1s',

          '&:hover': {
            backgroundColor: theme.colors.dark[6],
          },
          '&[data-active]': {
            backgroundColor: theme.colors.dark[6],
            '&:hover': {
              backgroundColor: theme.colors.dark[6],
            },
          },
        },
      })}
    >
      <Tabs.List>
        <Tabs.Tab value='pinned' icon={<IconPin size={16} />}>Pinned</Tabs.Tab>
        <Tabs.Tab value='threads' icon={<IconMessages size={16} />}>Threads</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value='pinned' sx={{
        height: 'calc(100% - 2.9rem)',
      }}>
        <PinnedTab {...props} />
      </Tabs.Panel>
      <Tabs.Panel value='threads' sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100% - 2.9rem)',
      }}>
        <ThreadsTab {...props} />
      </Tabs.Panel>
    </Tabs>
  );
}
