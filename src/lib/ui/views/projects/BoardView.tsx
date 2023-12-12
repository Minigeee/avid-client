import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mutate as _mutate } from 'swr';

import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  Center,
  CloseButton,
  Group,
  Loader,
  Menu,
  ScrollArea,
  Select,
  Skeleton,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip,
  Transition,
} from '@mantine/core';
import { useDebouncedValue, useTimeout } from '@mantine/hooks';
import {
  IconArrowIteration,
  IconChevronDown,
  IconChevronRight,
  IconChevronsUp,
  IconClock,
  IconFolders,
  IconLayoutKanban,
  IconListDetails,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconStar,
  IconStarFilled,
  IconTag
} from '@tabler/icons-react';

import { useConfirmModal } from '@/lib/ui/modals/ConfirmModal';
import KanbanView from './KanbanView';
import ListView from './ListView';
import TaskTagsSelector from '@/lib/ui/components/TaskTagsSelector';
import ActionButton from '@/lib/ui/components/ActionButton';
import MemberAvatar from '@/lib/ui/components/MemberAvatar';

import config from '@/config';
import {
  BoardWrapper,
  DomainWrapper,
  TasksWrapper,
  getLoadedSingleTasks,
  hasPermission,
  useApp,
  useBoard,
  useCachedState,
  useChatStyles,
  useMemoStateAsync,
  useSession,
  useTasks,
} from '@/lib/hooks';
import { Channel, ExpandedMember, ExpandedTask, TaskCollection, TaskPriority } from '@/lib/types';
import { openCreateTask, openCreateTaskCollection, openEditTaskCollection } from '@/lib/ui/modals';
import { remap, sortObject } from '@/lib/utility';
import { socket } from '@/lib/utility/realtime';

import moment from 'moment-business-days';
import { groupBy, throttle } from 'lodash';
import { AppState } from '@/lib/contexts';


////////////////////////////////////////////////////////////
export type NoGrouped = ExpandedTask[];
export type SingleGrouped = Record<string, ExpandedTask[]>;
export type DoubleGrouped = Record<string, Record<string, ExpandedTask[]>>;

////////////////////////////////////////////////////////////
export type GroupableFields = 'assignee' | 'tags' | 'priority' | 'due_date' | 'status';

////////////////////////////////////////////////////////////
type TabViewProps = {
  app: AppState;
  channel_id: string;
  board: BoardWrapper;
  tasks: TasksWrapper;
  domain: DomainWrapper;
  type: 'list' | 'kanban';

  collection: string;
  refreshEnabled: boolean;
  setRefreshEnabled: (value: boolean) => void;
};

////////////////////////////////////////////////////////////
function TabView({ board, type, refreshEnabled, setRefreshEnabled, ...props }: TabViewProps) {
  const session = useSession();

  // Filter tags
  const [filterTags, setFilterTags] = useCachedState<string[]>(`${board.id}.${props.collection}.${type}.tags`, []);
  // Groping field
  const [grouper, setGrouperImpl] = useCachedState<GroupableFields | null>(`${board.id}.${props.collection}.${type}.grouper`, props.app.board_states?.[board.id].group_by?.[props.collection] as GroupableFields || null);
  // Groping field (that changes when filter tags are done updating)
  const [grouperLagged, setGrouperLagged] = useState<GroupableFields | null>(null);
  // Real time search value
  const [search, setSearch] = useCachedState<string>(`${board.id}.${props.collection}.${type}.search`, '');
  // Debounced search value
  const [debouncedSearch] = useDebouncedValue(search, 200, { leading: true });
  // Selected assignee filter
  const [selectedAssignee, setSelectedAssignee] = useCachedState<string | null>(`${board.id}.${props.collection}.${type}.assignee`, null);
  // Extra assignee if it was chosen from dropdown
  const [extraAssignee, setExtraAssignee] = useState<ExpandedMember | null>(null);

  // Custom func to save grouping variable
  const setGrouper = useCallback((value: GroupableFields | null) => {
    props.app._mutators.setBoardState(board.id, { group_by: { [props.collection]: value } });
    setGrouperImpl(value);
  }, [props.app]);

  // Available grouping options
  const groupingOptions = useMemo(() => {
    const opts = [
      { value: 'assignee', label: 'Assignee' },
      { value: 'tags', label: 'Tags' },
      { value: 'priority', label: 'Priority' },
      { value: 'due_date', label: 'Due Date' },
    ];

    if (type !== 'kanban')
      opts.push({ value: 'status', label: 'Status' });

    return opts;
  }, [type]);

  // All assignees in board
  const assignees = useMemo(() => {
    const map: Record<string, ExpandedMember> = {};
    for (const task of props.tasks.data) {
      if (task.assignee)
        map[task.assignee.id] = task.assignee;
    }

    return Object.values(map).sort((a, b) => a.id === session.profile_id ? -1 : b.id === session.profile_id ? 1 : a.alias.localeCompare(b.alias));
  }, [props.tasks.data]);

  // Enable refresh on board activity
  useEffect(() => {
    function onActivity(channel_id: string) {
      if (channel_id !== props.channel_id) return;
      setRefreshEnabled(true);
    }

    socket().on('board:activity', onActivity);

    return () => {
      socket().off('board:activity', onActivity);
    };
  }, [props.channel_id]);


  // Filter tasks
  const [filtered, setFiltered] = useMemoStateAsync<NoGrouped | SingleGrouped | DoubleGrouped>(`${board.id}.${props.collection}.tasks`, async () => {
    // Set the lagged grouper variable
    setGrouperLagged(grouper);

    // Apply filter options
    const terms = debouncedSearch.toLocaleLowerCase().split(/\s+/);
    const filteredList = props.tasks.data.filter(x => {
      // Keep only tasks in the current collection, and ones that have the right assignee
      if ((x.collection !== props.collection && props.collection !== 'all') || (selectedAssignee && x.assignee?.id !== selectedAssignee))
        return false;

      // Search filter
      if (debouncedSearch && !x.sid.toString().includes(debouncedSearch)) {
        const lcSummary = x.summary.toLocaleLowerCase();

        for (const term of terms) {
          if (term.length > 0 && !lcSummary.includes(term))
            return false;
        }
      }

      // Make sure all tags exist in filtered tags
      for (const tag of filterTags) {
        if (x.tags && x.tags.findIndex(y => y === tag) >= 0)
          return true;
      }

      return filterTags.length === 0;
    });


    // Group tasks
    let grouped: Record<string, ExpandedTask[]> = {};

    // Assignee
    if (grouper === 'assignee') {
      grouped = groupBy(filteredList, task => task.assignee?.id || '_');
      grouped = sortObject(grouped, ([_a, a], [_b, b]) => a[0].assignee?.alias.localeCompare(b[0].assignee?.alias || '') || -1);
    }

    // Tags
    else if (grouper === 'tags') {
      const tagNames: Record<string, string> = {};

      // Add task to every tag group it contains
      for (const task of filteredList) {
        if (!task.tags?.length) {
          if (!grouped['_'])
            grouped['_'] = [];
          grouped['_'].push(task);
        }
        else {
          for (const tag of task.tags) {
            // Add space to prevent sort of numeric ids
            const tagStr = ' ' + tag;
            if (!grouped[tagStr]) {
              grouped[tagStr] = [];

              // Track tag name for sorting
              tagNames[tagStr] = board.tags.find(x => x.id === tag)?.label || '';
            }

            grouped[tagStr].push(task);
          }
        }
      }

      grouped = sortObject(grouped, ([a], [b]) => tagNames[a]?.localeCompare(tagNames[b] || '') || -1);
    }

    // Priority
    else if (grouper === 'priority') {
      grouped = groupBy(filteredList, task => task.priority || '_');
      grouped = sortObject(grouped, ([a], [b]) =>
        (a === '_' ? 100 : config.app.board.sort_keys.priority[a as TaskPriority]) -
        (b === '_' ? 100 : config.app.board.sort_keys.priority[b as TaskPriority])
      );
    }

    // Due Date
    else if (grouper === 'due_date') {
      grouped = groupBy(filteredList, task => task.due_date || '_');
      grouped = sortObject(grouped);
    }

    // Status
    else if (grouper === 'status') {
      // Add space to prevent sort of numeric ids
      grouped = groupBy(filteredList, task => ' ' + task.status);

      // Status map for sorting
      const statusMap: Record<string, number> = {};
      for (let i = 0; i < board.statuses.length; ++i)
        statusMap[' ' + board.statuses[i].id] = i;

      grouped = sortObject(grouped, ([a], [b]) => statusMap[a] - statusMap[b]);
    }

    // Apply status grouping for kanban
    if (type === 'kanban') {
      // Function to maintain kanban task order
      const maintainOrder = (oldGroups: SingleGrouped | undefined, newGroups: SingleGrouped) => {
        // If old groups don't exist, just use new groups without shifting order
        if (!oldGroups) return newGroups;

        // Maintain order (prevents snapping when changing status)
        const reordered: SingleGrouped = {};

        // Iterate (new) status groups
        for (const [status, newTasks] of Object.entries(newGroups)) {
          const group: ExpandedTask[] = [];
          const added = new Set<number>();
          const existing: Record<string, ExpandedTask> = {};

          // Make map of existing tasks in the (new) status group
          for (const task of newTasks)
            existing[task.sid] = task;

          // Iterate (old) status group and add tasks in order they appear, while keeping track of which tasks are added
          if (!Array.isArray(oldGroups)) {
            for (const task of (oldGroups[status] || [])) {
              if (existing[task.sid]) {
                group.push(existing[task.sid]);
                added.add(task.sid);
              }
            }
          }

          // Iterate (new) status group and add all tasks that haven't been added
          for (const task of newTasks) {
            if (!added.has(task.sid))
              group.push(task);
          }

          // Set status group
          reordered[status] = group;
        }

        return reordered;
      }

      // Determine if old tasks exist
      let exist = false;
      try { exist = filtered !== undefined; } catch (e) { }

      // If no grouper, just use simple status grouping
      if (grouper === null) {
        grouped = groupBy(filteredList, task => task.status);

        // Attempt to maintain task order
        if (exist)
          grouped = maintainOrder(filtered as SingleGrouped, grouped);
      }

      else {
        // Make subgroups
        const subgrouped: DoubleGrouped = {};

        for (const [id, group] of Object.entries(grouped)) {
          subgrouped[id] = groupBy(group, task => task.status);

          // Attempt to maintain task order
          if (exist)
            subgrouped[id] = maintainOrder((filtered as DoubleGrouped)[id], subgrouped[id]);
        }

        return subgrouped;
      }
    }

    // Null + not kanban
    else if (grouper === null)
      return filteredList;

    return grouped;

  }, [props.tasks.data, filterTags, grouper, props.collection, debouncedSearch, selectedAssignee]);


  return (
    <Stack spacing='xs' pb={64}>
      <Group align='end'>
        <Select
          data={groupingOptions}
          label='Group By'
          placeholder='None'
          clearable

          value={grouper}
          onChange={(value: GroupableFields | null) => {
            setGrouper(value);
          }}
        />

        <TaskTagsSelector
          data={Object.values(board.tags).map(x => ({ value: x.id, ...x }))}
          placeholder='Filter by tags'
          label='Tags'
          icon={<IconTag size={16} />}
          value={filterTags}
          onChange={setFilterTags}
        />

        {(hasPermission(props.domain, board.id, 'can_manage_tasks') || hasPermission(props.domain, board.id, 'can_manage_own_tasks')) && (
          <Button
            variant='gradient'
            onClick={() => {
              openCreateTask({
                board_id: board.id,
                domain: props.domain,
                collection: props.collection,
              });
            }}
          >
            Create Task
          </Button>
        )}

        {refreshEnabled && (
          <ActionButton
            tooltip='Refresh'
            mb={4}
            onClick={() => {
              // Refresh data
              if (board._exists)
                board._refresh();

              if (props.tasks._exists) {
                props.tasks._refresh();

                // Refresh individual tasks
                const indivTasks = getLoadedSingleTasks(board.id);
                for (const task of Array.from(indivTasks || []))
                  _mutate(task);
              }

              // Reset flag
              setRefreshEnabled(false);
            }}
          >
            <IconRefresh size={22} />
          </ActionButton>
        )}
      </Group>

      <Group align='end' mb={28}>
        <TextInput
          label='Search'
          placeholder='Search'
          icon={<IconSearch size={18} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          rightSection={search.length > 0 ? (
            <CloseButton
              onClick={() => setSearch('')}
            />
          ) : undefined}
          sx={{ width: config.app.ui.short_input_width }}
        />

        {assignees.length > 0 && (
          <Box>
            <Text size='sm' weight={600} mb={6}>Assignees</Text>
            <Group spacing={8}>
              <Avatar.Group>
                {assignees.slice(0, 5).map(member => (
                  <Tooltip
                    key={member.id}
                    label={member.alias}
                    withArrow
                  >
                    <MemberAvatar
                      size={38}
                      member={member}
                      sx={(theme) => ({
                        cursor: 'pointer',
                        border: `3px solid ${selectedAssignee === member.id ? theme.colors.indigo[5] : theme.colors.dark[6]}`,
                        filter: selectedAssignee === member.id ? undefined : 'brightness(0.9)',
                      })}
                      onClick={() => setSelectedAssignee(member.id)}
                    />
                  </Tooltip>
                ))}

                {extraAssignee && (
                  <Tooltip
                    label={extraAssignee.alias}
                    withArrow
                  >
                    <MemberAvatar
                      size={38}
                      member={extraAssignee}
                      sx={(theme) => ({
                        cursor: 'pointer',
                        border: `2px solid ${selectedAssignee === extraAssignee.id ? theme.colors.indigo[5] : theme.colors.dark[6]}`,
                        filter: selectedAssignee === extraAssignee.id ? undefined : 'brightness(0.9)',
                      })}
                      onClick={() => setSelectedAssignee(extraAssignee.id)}
                    />
                  </Tooltip>
                )}

                {assignees.length > 5 && (
                  <Menu styles={{
                    item: {
                      padding: '0.4rem 0.6rem',
                      minWidth: '10rem',
                    },
                    itemIcon: {
                      marginLeft: '0.5rem',
                    },
                  }}>
                    <Menu.Target>
                      <Avatar
                        size={38}
                        radius='xl'
                        sx={(theme) => ({
                          cursor: 'pointer',
                          backgroundColor: theme.colors.gray[7],
                        })}
                      >
                        {assignees.length - 5}+
                      </Avatar>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {assignees.slice(5).map(member => (
                        <Menu.Item
                          key={member.id}
                          icon={<MemberAvatar size={32} member={member} />}
                          sx={(theme) => ({
                            backgroundColor: selectedAssignee === member.id ? theme.colors.dark[4] : undefined,
                          })}
                          onClick={() => {
                            setSelectedAssignee(member.id);
                            setExtraAssignee(member);
                          }}
                        >
                          {member.alias}
                        </Menu.Item>
                      ))}
                    </Menu.Dropdown>
                  </Menu>
                )}
              </Avatar.Group>

              {selectedAssignee && (
                <CloseButton
                  size={24}
                  onClick={() => {
                    setSelectedAssignee(null);
                    setExtraAssignee(null);
                  }}
                />
              )}
            </Group>
          </Box>
        )}
      </Group>


      {filtered && type === 'list' && (
        <ListView
          board={board}
          tasks={props.tasks}
          domain={props.domain}
          collection={props.collection}

          filtered={filtered as NoGrouped | SingleGrouped}
          setFiltered={setFiltered}
          grouper={grouperLagged}
        />
      )}
      {filtered && type === 'kanban' && (
        <KanbanView
          board={board}
          tasks={props.tasks}
          domain={props.domain}
          collection={props.collection}

          filtered={filtered as SingleGrouped | DoubleGrouped}
          setFiltered={setFiltered}
          grouper={grouperLagged}
        />
      )}
    </Stack>
  );
}


////////////////////////////////////////////////////////////
interface GroupSelectItemProps extends React.ComponentPropsWithoutRef<'div'> {
  label: string;
  start_date?: string;
  end_date?: string;
}

////////////////////////////////////////////////////////////
const GroupSelectItem = forwardRef<HTMLDivElement, GroupSelectItemProps>(
  ({ label, start_date, end_date, ...others }: GroupSelectItemProps, ref) => {
    const t = new Date();
    const current = (start_date && t >= new Date(start_date)) && (!end_date || t <= moment(end_date).add(1, 'day').toDate());

    return (
      <div ref={ref} {...others}>
        <Group spacing={8} align='center'>
          {current && <IconStarFilled size={16} />}
          <Text weight={600}>{label}</Text>
        </Group>
        {(start_date || end_date) && (
          <Text size='xs' color='dimmed'>
            {start_date ? moment(start_date).format('l') : ''} - {end_date ? moment(end_date).format('l') : ''}
          </Text>
        )}
      </div>
    );
  }
);
GroupSelectItem.displayName = 'GroupSelectItem';


////////////////////////////////////////////////////////////
function BoardTabs(props: Omit<TabViewProps, 'type'>) {
  const [view, setView] = useCachedState<string>(`${props.board.id}.${props.collection}.view`, props.app.board_states?.[props.board.id].view?.[props.collection] || config.app.board.default_task_view);
  const onTabChange = useCallback((value: string) => {
    props.app._mutators.setBoardState(props.board.id, { view: { [props.collection]: value } });
    setView(value);
  }, [props.board.id, props.collection, props.app]);

  return (
    <Tabs
      variant='outline'
      mt={32}
      value={view}
      onTabChange={onTabChange}
      styles={(theme) => ({
        tab: {
          fontWeight: 500,
        },
      })}>
      <Tabs.List>
        <Tabs.Tab value='kanban' icon={<IconLayoutKanban size={19} />}>Kanban</Tabs.Tab>
        <Tabs.Tab value='list' icon={<IconListDetails size={18} />}>List</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value='kanban' mt={16}>
        <TabView
          key={props.collection}
          {...props}
          type={'kanban'}
        />
      </Tabs.Panel>
      <Tabs.Panel value='list' mt={16}>
        <TabView
          key={props.collection}
          {...props}
          type={'list'}
        />
      </Tabs.Panel>
    </Tabs>
  );
}

const MemoBoardTabs = memo(BoardTabs);


////////////////////////////////////////////////////////////
type BoardViewProps = {
  channel: Channel<'board'>;
  domain: DomainWrapper;
}

////////////////////////////////////////////////////////////
export default function BoardView(props: BoardViewProps) {
  const app = useApp();
  const board = useBoard(props.channel.data?.board);
  const tasks = useTasks(board.id, props.domain.id);

  const { classes } = useChatStyles();
  const { open: openConfirmModal } = useConfirmModal();

  const viewportRef = useRef<HTMLDivElement>(null);

  const [collectionId, setCollectionId] = useCachedState<string | null>(`${board.id}.collection`, null);
  // Refresh enabled
  const [refreshEnabled, setRefreshEnabled] = useState<boolean>(false);
  // Show scroll to top button
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);


  // Collection selections
  const collectionSelections = useMemo(() => {
    if (!board._exists) return [];

    const collections = board.collections.map(x => ({ value: x.id, label: x.name, ...x }));
    return [config.app.board.all_collection, ...collections.sort((a, b) =>
      a.start_date ?
        b.start_date ? new Date(b.start_date).getTime() - new Date(a.start_date).getTime() : 1 :
        b.start_date ? -1 : a.name.localeCompare(b.name)
    )];
  }, [board.collections]);

  // Map of collections
  const collectionMap = useMemo(() => {
    if (!board._exists) return {};

    const map: Record<string, TaskCollection> = {};
    for (const group of board.collections)
      map[group.id] = group;

    const all = config.app.board.all_collection;
    map[all.value] = all;
    return map;
  }, [board.collections]);
  // Get collection object for less typing
  const collection = collectionId ? collectionMap[collectionId] : null;

  // Set default view
  useEffect(() => {
    if (!board._exists) return;

    // If collection id exists, it is using cached value and should be left as is
    if (collectionId && collection)
      return;

    // Choose a current objective (choose the one with largest start date before today)
    const today = new Date();
    let bestCollection = board.collections[0];
    for (const c of board.collections) {
      if (!c.start_date) continue;
      const start = new Date(c.start_date);

      if (
        !bestCollection.start_date ||
        today >= start &&
        start >= new Date(bestCollection.start_date)
      ) {
        bestCollection = c;
      }
    }

    // Set best collection
    if (bestCollection.start_date)
      // Set collection id of first cycle that is current
      setCollectionId(bestCollection.id);
    else
      // Use backlog as default
      setCollectionId(config.app.board.default_backlog.id);
  }, [board._exists, collection]);

  // Render time text
  const timeText = useMemo(() => {
    if (!collection) return null;

    return (
      <>
        {collection.start_date ? moment(collection.start_date).format('l') : ''} -{' '}
        {collection.end_date ? moment(collection.end_date).format('l') : ''}{' '}
        <br />
        {(() => {
          const today = new Date();
          const started = collection.start_date && today >= new Date(collection.start_date);
          const time = started ? (collection.end_date || collection.start_date) : (collection.start_date || collection.end_date);
          if (!time) return '';

          const timeRef = time === collection.end_date ? 'end' : 'start';
          const diff = moment(time).diff(
            [today.getFullYear(), today.getMonth(), today.getDate()],
            'days'
          );

          if (diff < 0) {
            if (timeRef === 'end')
              return 'Passed';
            else
              return `${Math.abs(diff)} day${diff === -1 ? '' : 's'} since start`;
          }
          else if (diff === 0)
            return `${timeRef === 'end' ? 'Ends' : 'Starts'} Today`;
          else
            return `${diff} day${diff === 1 ? '' : 's'} ${timeRef === 'end' ? 'remaining' : 'until start'}`;
        })()}
      </>
    );
  }, [collection?.start_date, collection?.end_date]);

  // Refresh on stale data
  useEffect(() => {
    if (!app.stale[props.channel.id]) return;

    // Refresh data
    if (board._exists)
      board._refresh();

    if (tasks._exists) {
      tasks._refresh();

      // Refresh individual tasks
      const indivTasks = getLoadedSingleTasks(props.channel.data?.board || '');
      for (const task of Array.from(indivTasks || []))
        _mutate(task);
    }

    // Reset stale flag
    app._mutators.setStale(props.channel.id, false);
  }, []);


  // Handle add/remove collection
  useEffect(() => {
    function onAddCollection(board_id: string, collection: TaskCollection) {
      if (!board._exists || board_id !== board.id) return;
      // Add collection locally
      board._mutators.addCollectionLocal(collection);
    }

    function onDeleteCollection(board_id: string, collection_id: string) {
      if (!board._exists || board_id !== board.id) return;

      // Delete locally
      if (collectionId !== collection_id)
        board._mutators.removeCollectionLocal(collection_id);
      else {
        openConfirmModal({
          title: 'Collection Removed',
          content: (
            <>
              <Text>
                The collection you are viewing has been deleted by another user. Would you like
                to display these changes now or later?
              </Text>
              <Text size='sm' color='dimmed'>
                {'(You can use the refresh button to display these changes later)'}
              </Text>
            </>
          ),
          cancelLabel: 'Later',
          confirmLabel: 'Now',
          confirmProps: { variant: 'gradient' },
          onCancel: () => setRefreshEnabled(true),
          onConfirm: () => { board._mutators.removeCollectionLocal(collection_id) },
        });
      }
    }

    socket().on('board:add-collection', onAddCollection);
    socket().on('board:delete-collection', onDeleteCollection);

    return () => {
      socket().off('board:add-collection', onAddCollection);
      socket().off('board:delete-collection', onDeleteCollection);
    };
  }, [board._exists, collectionId]);

  // Called when scroll position changes
  const onScrollPosChange = useCallback(throttle((e: { x: number; y: number }) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    // Show scroll to bottom button if getting far from bottom
    if (e.y > 200) {
      if (!showScrollTop)
        setShowScrollTop(true);
    }
    else if (showScrollTop)
      setShowScrollTop(false);
  }, 50, { leading: false }), [showScrollTop]);


  if (!board._exists || !tasks._exists) return null;

  return (
    <Box sx={{
      position: 'relative',
      width: '100%',
      height: '100%',
    }}>
      <ScrollArea
        viewportRef={viewportRef}
        onScrollPositionChange={onScrollPosChange}
        sx={{
          width: '100%',
          height: '100%',
        }}
      >
        <Stack spacing={6} sx={(theme) => ({
          width: '100%',
          padding: '1.0rem 1.5rem 1.0rem 1.5rem'
        })}>
          <Group noWrap spacing={3} align='center' mb={16}>
            <Select
              data={collectionSelections}
              itemComponent={GroupSelectItem}
              rightSection={<IconChevronDown size={24} />}
              size='md'
              styles={(theme) => ({
                input: {
                  paddingTop: 0,
                  background: theme.colors.dark[6],
                  border: 'none',
                  fontFamily: theme.headings.fontFamily,
                  fontSize: theme.headings.sizes.h3.fontSize,
                  fontWeight: theme.headings.fontWeight as number, // "number" for typescript error
                },
                item: {
                  paddingTop: '0.4rem',
                  paddingBottom: '0.4rem',
                },
                rightSection: { pointerEvents: 'none' },
              })}
              value={collectionId}
              onChange={setCollectionId}
            />

            {hasPermission(props.domain, board.id, 'can_manage') && (
              <>
                {collection && (
                  <ActionIcon size='lg' mt={4} ml={8} onClick={() => openEditTaskCollection({
                    board,
                    domain: props.domain,
                    collection,
                    onDelete: () => setCollectionId(config.app.board.default_backlog.id),
                  })}>
                    <IconPencil />
                  </ActionIcon>
                )}
                <Menu width='20ch' position='bottom-start'>
                  <Menu.Target>
                    <ActionIcon size='lg' mt={4}>
                      <IconPlus />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      icon={<IconArrowIteration size={20} />}
                      onClick={() => openCreateTaskCollection({
                        board,
                        domain: props.domain,
                        mode: 'objective',
                        onCreate: (id) => setCollectionId(id),
                      })}
                    >
                      New Objective
                    </Menu.Item>
                    <Menu.Item
                      icon={<IconFolders size={19} />}
                      onClick={() => openCreateTaskCollection({
                        board,
                        domain: props.domain,
                        mode: 'collection',
                        onCreate: (id) => setCollectionId(id),
                      })}
                    >
                      New Collection
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </>
            )}

            <div style={{ flexGrow: 1 }} />
            {collection && (collection.start_date || collection.end_date) && (
              <>
                <Text size='sm' color='dimmed' weight={600} align='right'>
                  {timeText}
                </Text>
                <Box mt={6} mr={8} ml={6} sx={(theme) => ({ color: theme.colors.dark[2] })}>
                  <IconClock size={32} />
                </Box>
              </>
            )}
          </Group>

          {collectionId && collection && (
            <>
              <Text
                className={classes.typography}
                size='md'
                mt={8}
                sx={{ maxWidth: '100ch' }}
                dangerouslySetInnerHTML={{ __html: collection.description || '' }}
              />

              <MemoBoardTabs
                key={collectionId}
                app={app}
                channel_id={props.channel.id}
                board={board}
                tasks={tasks}
                domain={props.domain}
                collection={collectionId}
                refreshEnabled={refreshEnabled}
                setRefreshEnabled={setRefreshEnabled}
              />
            </>
          )}
        </Stack>
      </ScrollArea>

      {showScrollTop && (
        <ActionButton
          tooltip='Scroll To Top'
          tooltipProps={{ position: 'left', openDelay: 500 }}
          variant='filled'
          size='xl'
          radius='xl'
          sx={(theme) => ({
            position: 'absolute',
            top: '2.0rem',
            right: '2.5rem',
            backgroundColor: theme.colors.dark[8],
            '&:hover': {
              backgroundColor: theme.colors.dark[6],
            },
          })}
          onClick={() => {
            if (viewportRef.current) {
              viewportRef.current.scrollTo({
                top: 0,
              });
            }
          }}
        >
          <IconChevronsUp />
        </ActionButton>
      )}
    </Box>
  );
}
