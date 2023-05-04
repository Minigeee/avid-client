import { forwardRef, useMemo, useState } from 'react';

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
  ArrowIteration,
  ChevronDown,
  Clock,
  Folders,
  LayoutKanban,
  ListDetails,
  Plus,
  Tag
} from 'tabler-icons-react';

import KanbanView from './KanbanView';
import ListView from './ListView';
import TaskTagsSelector from '@/lib/ui/components/TaskTagsSelector';

import config from '@/config';
import {
  BoardWrapper,
  DomainWrapper,
  TasksWrapper,
  useBoard,
  useChatStyles,
  useMemoState,
  useTasks,
} from '@/lib/hooks';
import { Channel, ExpandedTask, TaskCollection, TaskPriority } from '@/lib/types';
import { openCreateTask } from '@/lib/ui/modals';
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
      // TODO : Filter out tasks not in current group

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
            if (!grouped[tag]) {
              grouped[tag] = [];

              // Track tag name for sorting
              tagNames[tag] = board.tags.find(x => x.id === tag)?.label || '';
            }

            grouped[tag].push(task);
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
      grouped = groupBy(filteredList, task => task.status);

      // Status map for sorting
      const statusMap: Record<string, number> = {};
      for (let i = 0; i < board.statuses.length; ++i)
        statusMap[board.statuses[i].id] = i;

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

        // Make list of existing tasks
        const existing = new Set<number>();
        for (const taskList of Object.values(newGroups)) {
          for (const task of taskList)
            existing.add(task.sid);
        }

        // Iterate (new) status groups
        for (const [status, newTasks] of Object.entries(newGroups)) {
          const group: ExpandedTask[] = [];
          const added = new Set<number>();

          // Iterate (old) status group and add tasks in order they appear, while keeping track of which tasks are added
          if (!Array.isArray(oldGroups)) {
            for (const task of (oldGroups[status] || [])) {
              if (existing.has(task.sid)) {
                group.push(task);
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

  }, [props.tasks, filterTags, grouper]);


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
          icon={<Tag size={16} />}
          value={filterTags}
          onChange={setFilterTags}
        />
        <Button
          variant='gradient'
          onClick={() => {
            openCreateTask({
              board_id: board.id,
              domain: props.domain,
            });
          }}
        >
          Create Task
        </Button>
      </Group>

      {type === 'list' && (
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
      {type === 'kanban' && (
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
  name: string;
  start_date?: string;
  end_date?: string;
}

////////////////////////////////////////////////////////////
const GroupSelectItem = forwardRef<HTMLDivElement, GroupSelectItemProps>(
  ({ name, start_date, end_date, ...others }: GroupSelectItemProps, ref) => (
    <div ref={ref} {...others}>
      <Title order={5}>{name}</Title>
      {(start_date || end_date) && (
        <Text size='xs' color='dimmed'>
          {start_date ? moment(start_date).format('l') : ''} - {end_date ? moment(end_date).format('l') : ''}
        </Text>
      )}
    </div>
  )
);


////////////////////////////////////////////////////////////
type BoardViewProps = {
  channel: Channel<'board'>;
  domain: DomainWrapper;
  view?: 'list' | 'kanban';
}

////////////////////////////////////////////////////////////
export default function BoardView(props: BoardViewProps) {
  const board = useBoard(props.channel.data?.board);
  const tasks = useTasks(board.id);
  
  const { classes } = useChatStyles();
  
  const [collectionId, setCollectionId] = useState<string | null>(config.app.board.default_backlog_id);
  const [view, setView] = useState<string | null>(config.app.board.default_task_view);

  const collectionMap = useMemo(() => {
    if (!board._exists) return {};

    const map: Record<string, TaskCollection> = {};
    for (const group of board.collections)
      map[group.id] = group;
    return map;
  }, [board.collections]);


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
        <Group noWrap spacing='xs' align='center' mb={16}>
          <Select
            data={board.collections.map(x => ({ value: x.id, label: x.name, ...x }))}
            itemComponent={GroupSelectItem}
            rightSection={<ChevronDown size={24} />}
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
            })}
            value={collectionId}
            onChange={setCollectionId}
          />
          <Menu width='20ch' position='bottom-start'>
            <Menu.Target>
              <ActionIcon size='lg' mt={4}>
                <Plus />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item icon={<ArrowIteration size={20} />}>New Cycle</Menu.Item>
              <Menu.Item icon={<Folders size={19} />}>New Collection</Menu.Item>
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
                  const diff = moment(collection.end_date).businessDiff(moment(new Date()));
                  return `${diff} working day${diff === 1 ? '' : 's'} remaining`;
                })()}
              </Text>
              <Box mt={6} mr={8} sx={(theme) => ({ color: theme.colors.dark[2] })}>
                <Clock size={32} />
              </Box>
            </>
          )}
        </Group>

        {collectionId && collection && (
          <>
            <Text
              className={classes.typography}
              size='sm'
              mt={8}
              sx={{ maxWidth: '100ch' }}
              dangerouslySetInnerHTML={{ __html: collection.description || '' }}
            />

            <Tabs
              variant='outline'
              mt={32}
              value={view}
              onTabChange={setView}
              styles={(theme) => ({
                tab: {
                  fontWeight: 500,
                },
              })}>
              <Tabs.List>
                <Tabs.Tab value='list' icon={<ListDetails size={18} />}>List</Tabs.Tab>
                <Tabs.Tab value='kanban' icon={<LayoutKanban size={19} />}>Kanban</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value='list' mt={16}>
                <TabView
                  board={board}
                  tasks={tasks}
                  domain={props.domain}
                  type={'list'}
                  collection={collectionId}
                />
              </Tabs.Panel>
              <Tabs.Panel value='kanban' mt={16}>
                <TabView
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
