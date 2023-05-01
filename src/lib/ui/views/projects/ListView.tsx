import { useState } from 'react';

import {
  Accordion,
  ActionIcon,
  Box,
  Button,
  Center,
  Group,
  Select,
  Stack,
  Text,
  useMantineTheme,
} from '@mantine/core';

import { ChevronDown, Plus, Tag } from 'tabler-icons-react';

import { openCreateTask, openEditTask } from '@/lib/ui/modals';
import { CreateTaskProps } from '@/lib/ui/modals/CreateTask';
import MemberAvatar from '@/lib/ui/components/MemberAvatar';
import TaskPriorityIcon from '@/lib/ui/components/TaskPriorityIcon';
import TaskTagsSelector from '@/lib/ui/components/TaskTagsSelector';

import config from '@/config';
import {
  BoardWrapper,
  DomainWrapper,
  TasksWrapper,
  useMemo,
  useMemoState,
} from '@/lib/hooks';
import { ExpandedTask, TaskTag } from '@/lib/types';

import { groupBy, round } from 'lodash';
import DataTable from 'react-data-table-component';


////////////////////////////////////////////////////////////
const PRIORITY_LABELS = ['Critical', 'High', 'Medium', 'Low', 'None'];


////////////////////////////////////////////////////////////
type TaskTableProps = {
  board: BoardWrapper;
  domain: DomainWrapper;
  tasks: ExpandedTask[];

  /** Currently chosen grouping field */
  groupingField: keyof ExpandedTask | null;
  /** The group this table is part of */
  group: string;
  
  statusColors?: Record<string, string>;
  tags?: Record<string, TaskTag>;
};

////////////////////////////////////////////////////////////
function TaskTable({ board, tasks, ...props }: TaskTableProps) {
  const theme = useMantineTheme();

  return (
    <DataTable
      customStyles={{
        table: {
          style: {
            marginBottom: '2.5rem',
            borderRadius: '6px',
            backgroundColor: theme.colors.dark[8],
            color: theme.colors.dark[0],
          }
        },
        headRow: {
          style: {
            fontSize: `${theme.fontSizes.sm}px`,
            fontWeight: 600,
            backgroundColor: 'transparent',
            color: theme.colors.dark[0],
            borderBottom: `1px solid ${theme.colors.dark[4]}`,
          }
        },
        rows: {
          style: {
            padding: '0.5rem 0rem',
            fontSize: `${theme.fontSizes.sm}px`,
            color: theme.colors.dark[0],
            backgroundColor: theme.colors.dark[7],
            borderTop: `1px solid ${theme.colors.dark[4]}`,
            borderBottom: `1px solid ${theme.colors.dark[4]}`,
          },
          highlightOnHoverStyle: {
            color: theme.colors.dark[0],
            backgroundColor: theme.colors.dark[6],
            transitionDuration: '0.08s',
            transitionProperty: 'background-color',
            borderBottomColor: 'transparent',
            outlineWidth: '0px',
            '&:last-child': {
              borderBottomColor: theme.colors.dark[4],
            },
          },
        },
      }}
      sortIcon={<ChevronDown size={10} style={{ marginTop: '5px', marginLeft: '1px' }} />}

      columns={[
        {
          name: 'Priority',
          center: true,
          grow: 0.8,
          cell: (task: ExpandedTask) => (
            <TaskPriorityIcon priority={task.priority} outerSize={24} innerSize={18} sx={{  }} />
          ),
          sortable: true,
          sortFunction: (a: ExpandedTask, b: ExpandedTask) => (b.priority || 0) - (a.priority || 0),
        },
        {
          name: 'ID',
          grow: 1,
          style: { fontWeight: 600 },
          selector: (task: ExpandedTask) => `${board.prefix}-${task.sid}`,
          sortable: true,
          sortFunction: (a: ExpandedTask, b: ExpandedTask) => a.sid - b.sid,
        },
        {
          name: 'Summary',
          grow: 8,
          selector: (task: ExpandedTask) => task.summary,
        },
        {
          name: 'Status',
          center: true,
          grow: 2,
          cell: (task: ExpandedTask) => (
            <Text data-tag='allowRowEvents' weight={600} sx={{
              padding: '1px 13px 2px 11px',
              width: 'fit-content',
              maxWidth: 'calc(100% - 1.0rem)',
              backgroundColor: props.statusColors ? props.statusColors[task.status] : undefined,
              borderRadius: 3,
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}>
              {task.status}
            </Text>
          ),
          sortable: true,
          sortFunction: (a: ExpandedTask, b: ExpandedTask) => a.status.localeCompare(b.status),
        },
        {
          name: 'Assignee',
          center: true,
          grow: 1,
          cell: (task: ExpandedTask) =>
            task.assignee ? (
              <MemberAvatar
                member={task.assignee}
                size={32}
              />
            ) : undefined,
            sortable: true,
            sortFunction: (a: ExpandedTask, b: ExpandedTask) => a.assignee?.alias.localeCompare(b.assignee?.alias || '') || -1,
        },
        {
          name: 'Tags',
          grow: 3,
          cell: (task: ExpandedTask) =>{
            if (!props.tags || !task.tags || task.tags.length === 0) return;

            // Prioritize tag group if grouping by tags
            let tags: number[];
            if (props.groupingField === 'tags') {
              const priority = parseInt(props.group);
              tags = [priority, ...task.tags.filter(x => x !== priority).sort()];
            }
            else
              tags = [...task.tags].sort();

            return (
              <Group spacing={6} mb={task.assignee ? 0 : 5}>
                {tags.map((id, i) => {
                  const tag = props.tags?.[id];
                  if (!tag) return;

                  return (
                    <Box sx={{
                      padding: '1px 11px 2px 11px',
                      backgroundColor: tag.color,
                      borderRadius: 15,
                      cursor: 'default',
                    }}>
                      <Text size='xs' weight={500}>{tag.label}</Text>
                    </Box>
                  );
                })}
              </Group>
            );
          },
        },
        {
          name: (
            <ActionIcon
              onClick={() => {
                if (board._exists) {
                  // Add starting group data
                  const groupData: Partial<CreateTaskProps> = {};
                  if (props.groupingField === 'assignee')
                    groupData.assignee = tasks[0].assignee || undefined;
                  else if (props.groupingField === 'tags')
                    groupData.tag = props.group;
                  else if (props.groupingField === 'priority')
                    groupData.priority = tasks[0].priority;
                  else if (props.groupingField === 'status')
                    groupData.status = tasks[0].status;

                  openCreateTask({
                    board_id: board.id,
                    domain: props.domain,
                    ...groupData,
                  });
                }
              }}
            >
              <Plus size={19} />
            </ActionIcon>
          ),
          grow: 0,
          right: true,
        },
      ]}
      data={tasks}

      responsive={false}
      pointerOnHover
      highlightOnHover
      onRowClicked={(task) => {
        if (board._exists)
          openEditTask({
            board_id: board.id,
            board_prefix: board.prefix,
            domain: props.domain,
            task: task,
          });
      }}
    />
    );
}


////////////////////////////////////////////////////////////
type ListViewProps = {
  board: BoardWrapper;
  tasks: TasksWrapper;
  domain: DomainWrapper;
}

////////////////////////////////////////////////////////////
export default function ListView({ board, ...props }: ListViewProps) {
  // Filter tags
  const [filterTags, setFilterTags] = useState<string[]>([]);
  // Groping field
  const [groupingField, setGroupingField] = useState<keyof ExpandedTask | null>(null);

  // Currently expanded fields per group by view
  const [expanded, setExpanded] = useState<Record<string, string[]>>({});


  // Group tasks by collection
  const [tasks, setTasks] = useMemoState<Record<string, ExpandedTask[]>>(
    () => {
      if (!props.tasks._exists) return;

      // Apply filter options
      const filterTagInts = filterTags.map(x => parseInt(x));
      const filtered = props.tasks.data.filter(x => {
        // Make sure all tags exist in filtered tags
        for (const tag of filterTagInts) {
          if (x.tags && x.tags.findIndex(y => y === tag) >= 0)
            return true;
        }

        return filterTagInts.length === 0;
      });

      let data: Record<string, ExpandedTask[]> = {};

      // Different fields have different grouping methods
      if (groupingField === null) {
        data['none'] = filtered;
      }
      else if (groupingField === 'tags') {
        // Iterate all tasks and add to each tag group
        for (const task of filtered) {
          for (const tag_id of (task.tags || [])) {
            if (!data[tag_id])
              data[tag_id] = [];

            data[tag_id].push(task);
          }
        }
      }
      else if (groupingField === 'assignee') {
        // Iterate all tasks and add to each tag group
        for (const task of filtered) {
          const id = task.assignee?.id || 'unassigned';
          if (!data[id])
            data[id] = [];

          data[id].push(task);
        }
      }
      else {
        data = groupBy(filtered, (task) => task[groupingField]);
      }

      // If this is first time switching group by value, set default expanded tabs
      const expandKey = `${groupingField}`;
      if (!expanded[expandKey])
        setExpanded({ ...expanded, [expandKey]: Object.keys(data) });

      return data;
    },
    [props.tasks.data, groupingField, filterTags]
  );

  // Status colors
  const statusColors = useMemo<Record<string, string>>(() => {
    if (!board.statuses) return;

    const map: Record<string, string> = {};
    for (const status of board.statuses)
      map[status.label] = status.color;

    return map;
  }, [board.statuses]);

  // Create tags map
  const tags = useMemo<Record<string, TaskTag & { value: string }>>(() => {
    if (!board?.tags) return {};

    // Add tags to map
    const map: Record<string, TaskTag & { value: string }> = {};
    for (const tag of board.tags)
      map[tag.id] = { ...tag, value: tag.id.toString() };

    return map;
  }, [board?.tags]);

  
  // Key used to find expand values
  const expandKey = `${groupingField}`;

  return (
    <Stack spacing={32} sx={(theme) => ({
      width: '100%',
      height: '100%',
      padding: '1.0rem 1.5rem 1.0rem 1.5rem'
    })}>
      <Group align='end'>
        <Select
          data={[
            { value: 'assignee', label: 'Assignee' },
            { value: 'tags', label: 'Tags' },
            { value: 'priority', label: 'Priority' },
            { value: 'status', label: 'Status' },
          ]}
          label='Group By'
          placeholder='None'
          clearable

          value={groupingField}
          onChange={(value: keyof ExpandedTask | null) => {
            setGroupingField(value);
          }}
        />

        <TaskTagsSelector
          data={Object.values(tags || {})}
          placeholder='Filter by tags'
          label='Filters'
          icon={<Tag size={16} />}
          value={filterTags}
          onChange={setFilterTags}
        />
        <Button
          variant='gradient'
          onClick={() => {
            if (board._exists)
              openCreateTask({
                board_id: board.id,
                domain: props.domain,
              });
          }}
        >
          Create Task
        </Button>
      </Group>

      {groupingField && (
        <Accordion
          value={expanded[expandKey] || []}
          onChange={(values) => setExpanded({ ...expanded, [expandKey]: values })}
          multiple
          sx={{
            minWidth: '100ch',
          }}
          styles={(theme) => ({
            item: {
              borderWidth: 2,
            },
          })}
        >
          {Object.entries(tasks || {})?.map(([group, tasks], group_idx) => (
            <Accordion.Item value={group}>
              <Accordion.Control>
                <Group noWrap>
                  {groupingField === 'assignee' && (<MemberAvatar member={group === 'unassigned' ? null : tasks[0].assignee} size={32} />)}
                  <Text weight={600} size='lg'>
                    {
                      groupingField === 'tags' ?
                        tags?.[group]?.label :
                        groupingField === 'assignee' ?
                          group === 'unassigned' ? 'Unassigned' : tasks[0].assignee?.alias :
                          groupingField === 'priority' ?
                            PRIORITY_LABELS[group as unknown as number] :
                            group
                    }
                  </Text>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <TaskTable
                  board={board}
                  domain={props.domain}
                  tasks={tasks}
                  groupingField={groupingField}
                  group={group}
                  tags={tags}
                  statusColors={statusColors}
                />
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
      {!groupingField && (
        <TaskTable
          board={board}
          domain={props.domain}
          tasks={tasks?.['none'] || []}
          groupingField={groupingField}
          group={'none'}
          tags={tags}
          statusColors={statusColors}
        />
      )}
    </Stack>
  );
}
