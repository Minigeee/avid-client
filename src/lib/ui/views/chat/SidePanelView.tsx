import { forwardRef, useEffect, useMemo, useState } from 'react';

import {
  Box,
  Center,
  Flex,
  Group,
  ScrollArea,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { IconMessages, IconPencil } from '@tabler/icons-react';

import MessagesView, { MessageViewContextState } from './MessagesView';
import MemberAvatar from '@/lib/ui/components/MemberAvatar';
import ActionButton from '@/lib/ui/components/ActionButton';

import { DomainWrapper, hasPermission, useMember, useMembers, useSession, useThreads } from '@/lib/hooks';
import { ExpandedMember, Member } from '@/lib/types';

import moment from 'moment';
import { useForm } from '@mantine/form';


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
                Reply to a message to start a new thread
              </Text>
            )}
          </div>
        </Center>
      )}
    </>
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
  const [tab, setTab] = useState<string | null>('threads');

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
        <Tabs.Tab value='pinned'>Pinned</Tabs.Tab>
        <Tabs.Tab value='threads'>Threads</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value='pinned'>
        Pinned
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
