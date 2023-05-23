import { forwardRef, useEffect, useMemo, useState } from 'react';

import {
  ActionIcon,
  Box,
  Button,
  Group,
  Menu,
  ScrollArea,
  Select,
  Stack,
  Tabs,
  Text,
  Title,
  Transition,
} from '@mantine/core';
import {
  IconArrowIteration,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconFolders,
  IconLayoutKanban,
  IconListDetails,
  IconPencil,
  IconPlus,
  IconTag
} from '@tabler/icons-react';

import KanbanView from './KanbanView';
import ListView from './ListView';
import TaskTagsSelector from '@/lib/ui/components/TaskTagsSelector';

import config from '@/config';
import {
  BoardWrapper,
  DomainWrapper,
  TasksWrapper,
  useApp,
  useBoard,
  useChatStyles,
  useMemoState,
  useTasks,
} from '@/lib/hooks';
import { Channel, ExpandedTask, TaskCollection, TaskPriority } from '@/lib/types';
import { openCreateTask, openCreateTaskCollection, openEditTaskCollection } from '@/lib/ui/modals';
import { remap, sortObject } from '@/lib/utility';

import moment from 'moment-business-days';
import { groupBy } from 'lodash';


////////////////////////////////////////////////////////////
export type NoGrouped = ExpandedTask[];
export type SingleGrouped = Record<string, ExpandedTask[]>;
export type DoubleGrouped = Record<string, Record<string, ExpandedTask[]>>;

////////////////////////////////////////////////////////////
export type GroupableFields = 'assignee' | 'tags' | 'priority' | 'due_date' | 'status';

////////////////////////////////////////////////////////////
type TabViewProps = {
  board: BoardWrapper;
  tasks: TasksWrapper;
  domain: DomainWrapper;
  type: 'list' | 'kanban';

  collection: string;
};

////////////////////////////////////////////////////////////
function TabView({ board, type, ...props }: TabViewProps) {
  // Filter tags
  const [filterTags, setFilterTags] = useState<string[]>([]);
  // Groping field
  const [grouper, setGrouper] = useState<GroupableFields | null>(null);
  // Groping field (that changes when filter tags are done updating)
  const [grouperLagged, setGrouperLagged] = useState<GroupableFields | null>(null);

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


  // Filter tasks
  const [filtered, setFiltered] = useMemoState<NoGrouped | SingleGrouped | DoubleGrouped>(() => {
    // Set the lagged grouper variable
    setGrouperLagged(grouper);

    // Apply filter options
    const filteredList = props.tasks.data.filter(x => {
      // Keep only tasks in the current collection
      if (x.collection !== props.collection && props.collection !== 'all')
        return false;

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

  }, [props.tasks.data, filterTags, grouper, props.collection]);


  return (
    <Stack spacing={32} pb={64}>
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
          label='Filters'
          icon={<IconTag size={16} />}
          value={filterTags}
          onChange={setFilterTags}
        />
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
      </Group>

      <div style={{ display: type === 'list' ? undefined : 'none' }}>
        <ListView
          board={board}
          tasks={props.tasks}
          domain={props.domain}
          collection={props.collection}

          filtered={filtered as NoGrouped | SingleGrouped}
          setFiltered={setFiltered}
          grouper={grouperLagged}
        />
      </div>

      <div style={{ display: type === 'kanban' ? undefined : 'none' }}>
        <KanbanView
          board={board}
          tasks={props.tasks}
          domain={props.domain}
          collection={props.collection}

          filtered={filtered as SingleGrouped | DoubleGrouped}
          setFiltered={setFiltered}
          grouper={grouperLagged}
        />
      </div>
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
    const current = start_date && end_date &&
      t >= new Date(start_date) &&
      t <= moment(end_date).add(1, 'day').toDate();

    return (
      <div ref={ref} {...others}>
        <Group spacing={3} align='center'>
          {current && <IconChevronRight size={18} style={{ marginLeft: -4, marginTop: 1 }} />}
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
type BoardViewProps = {
  channel: Channel<'board'>;
  domain: DomainWrapper;
}

////////////////////////////////////////////////////////////
export default function BoardView(props: BoardViewProps) {
  const app = useApp();
  const board = useBoard(props.channel.data?.board);
  const tasks = useTasks(board.id);
  
  const { classes } = useChatStyles();
  
  const [collectionId, setCollectionId] = useState<string | null>(
    app.navigation.board.collections[board.id || '']
  );
  const [view, setView] = useState<string | null>(
    app.navigation.board.views[board.id || ''] || config.app.board.default_task_view
  );

  // Collection selections
  const collectionSelections = useMemo(() => {
    if (!board._exists) return [];

    const collections = board.collections.map(x => ({ value: x.id, label: x.name, ...x }));
    return [config.app.board.all_collection, ...collections.sort((a, b) =>
      a.end_date ?
        b.end_date ? new Date(b.end_date).getTime() - new Date(a.end_date).getTime() : 1 :
        b.end_date ? -1 : a.name.localeCompare(b.name)
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

  // Set default view
  useEffect(() => {
    if (!board._exists) return;

    // Used nav state if available
    const nav = app.navigation.board.collections[board.id];
    if (nav) {
      setCollectionId(nav);
      return;
    }

    // Choose a current cycle
    const today = new Date();
    for (const c of board.collections) {
      if (c.start_date && c.end_date &&
        today >= new Date(c.start_date) &&
        today <= moment(c.end_date).add(1, 'day').toDate()
      ) {
        // Set collection id of first cycle that is current
        setCollectionId(c.id);
        
        // Set nav state for faster load
        if (!nav)
          app._mutators.navigation.board.setCollection(board.id, c.id);
          
        return;
      }
    }

    // Use backlog as default
    setCollectionId(config.app.board.default_backlog.id);
  }, [board._exists]);


  // Get collection object for less typing
  const collection = collectionId ? collectionMap[collectionId] : null;

  if (!board._exists || !tasks._exists) return null;

  return (
    <ScrollArea sx={{
      width: '100%',
      height: '100%',
    }}>
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
              rightSection: {pointerEvents: 'none' },
            })}
            value={collectionId}
            onChange={(value) => {
              setCollectionId(value);
              if (value)
                app._mutators.navigation.board.setCollection(board.id, value);
            }}
          />

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
                  mode: 'cycle',
                  onCreate: (id) => setCollectionId(id),
                })}
              >
                New Cycle
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

          <div style={{ flexGrow: 1 }} />
          {collection && (collection.start_date || collection.end_date) && (
            <>
              <Text size='sm' color='dimmed' weight={600} align='right'>
                {collection.start_date ? moment(collection.start_date).format('l') : ''} -{' '}
                {collection.end_date ? moment(collection.end_date).format('l') : ''}{' '}
                <br />
                {(() => {
                  if (!collection.end_date) return '';
                  const today = new Date();
                  const started = collection.start_date && today >= new Date(collection.start_date);
                  const diff = moment(started ? collection.end_date : collection.start_date).diff(
                    [today.getFullYear(), today.getMonth(), today.getDate()],
                    'days'
                  );
                  if (diff < 0)
                    return 'Passed';
                  else if (diff === 0)
                    return `${started ? 'Ends' : 'Starts'} Today`;
                  else
                    return `${diff} day${diff === 1 ? '' : 's'} ${started ? 'remaining' : 'until start'}`;
                })()}
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

            <Tabs
              variant='outline'
              mt={32}
              value={view}
              onTabChange={(value) => {
                setView(value);
                if (value)
                  app._mutators.navigation.board.setView(board.id, value as 'list' | 'kanban');
              }}
              styles={(theme) => ({
                tab: {
                  fontWeight: 500,
                },
              })}>
              <Tabs.List>
                <Tabs.Tab value='list' icon={<IconListDetails size={18} />}>List</Tabs.Tab>
                <Tabs.Tab value='kanban' icon={<IconLayoutKanban size={19} />}>Kanban</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value='list' mt={16}>
                <TabView
                  key={collectionId}
                  board={board}
                  tasks={tasks}
                  domain={props.domain}
                  type={'list'}
                  collection={collectionId}
                />
              </Tabs.Panel>
              <Tabs.Panel value='kanban' mt={16}>
                <TabView
                  key={collectionId}
                  board={board}
                  tasks={tasks}
                  domain={props.domain}
                  type={'kanban'}
                  collection={collectionId}
                />
              </Tabs.Panel>
            </Tabs>
          </>
        )}
      </Stack>
    </ScrollArea>
  );
}
