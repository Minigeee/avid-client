import { useMemo, useState } from 'react';

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
  useMemoState,
} from '@/lib/hooks';
import { ExpandedTask, Label } from '@/lib/types';

import { groupBy, round } from 'lodash';
import moment from 'moment';
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
  
  statuses: Record<string, Label & { index: number }>;
  tags: Record<string, Label>;
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
          sortFunction: (a: ExpandedTask, b: ExpandedTask) =>
            (b.priority ? config.app.board.sort_keys.priority[b.priority] : 100) -
            (a.priority ? config.app.board.sort_keys.priority[a.priority] : 100),
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
              backgroundColor: props.statuses[task.status].color,
              borderRadius: 3,
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}>
              {props.statuses[task.status].label}
            </Text>
          ),
          sortable: true,
          sortFunction: (a: ExpandedTask, b: ExpandedTask) => props.statuses[a.status].index - props.statuses[b.status].index,
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
          name: 'Due Date',
          center: true,
          grow: 1.2,
          cell: (task: ExpandedTask) =>
            task.due_date ? (
              <Text data-tag='allowRowEvents' size='sm' weight={600}>
                {moment(task.due_date).format('l')}
              </Text>
            ) : undefined,
          sortable: true,
          sortFunction: (a: ExpandedTask, b: ExpandedTask) => new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime(),
        },
        {
          name: 'Tags',
          grow: 3,
          cell: (task: ExpandedTask) =>{
            if (!props.tags || !task.tags || task.tags.length === 0) return;

            // Prioritize tag group if grouping by tags
            let tags: string[];
            if (props.groupingField === 'tags')
              tags = [props.group, ...task.tags.filter(x => x !== props.group).sort()];
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
                    groupData.priority = tasks[0].priority || undefined;
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


  // Tag map
  const tagMap = useMemo<Record<string, Label>>(() => {
    const map: Record<string, Label> = {};
    for (const tag of board.tags)
      map[tag.id] = tag;
    return map;
  }, [board.tags]);
  
  // Status map
  const statusMap = useMemo<Record<string, Label & { index: number }>>(() => {
    const map: Record<string, Label & { index: number }> = {};
    for (let i = 0; i < board.statuses.length; ++i) {
      const s = board.statuses[i];
      map[s.id] = { ...s, index: i };
    }
    return map;
  }, [board.statuses]);

  // Group tasks by collection
  const [tasks, setTasks] = useMemoState<Record<string, ExpandedTask[]>>(
    () => {
      if (!props.tasks._exists) return {};

      // Apply filter options
      const filtered = props.tasks.data.filter(x => {
        // Make sure all tags exist in filtered tags
        for (const tag of filterTags) {
          if (x.tags && x.tags.findIndex(y => y === tag) >= 0)
            return true;
        }

        return filterTags.length === 0;
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

          if (!task.tags?.length) {
            if (!data[0])
              data[0] = [];

            data[0].push(task);
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
      else if (groupingField === 'due_date') {
        data = groupBy(filtered, (task) => task.due_date || '_nodate');
        data = Object.keys(data).sort().reduce((obj: any, key: any) => {
          obj[key] = data[key];
          return obj;
        }, {});
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
            { value: 'due_date', label: 'Due Date' },
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
                        group !== '0' ? tagMap[group]?.label : 'No Tags' :
                        groupingField === 'assignee' ?
                          group === 'unassigned' ? 'Unassigned' : tasks[0].assignee?.alias :
                          groupingField === 'priority' ?
                            PRIORITY_LABELS[group as unknown as number] :
                            groupingField === 'due_date' ?
                              tasks[0].due_date ? moment(tasks[0].due_date).format('ll') : 'No Due Date' :
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
                  statuses={statusMap}
                  tags={tagMap}
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
          statuses={statusMap}
          tags={tagMap}
        />
      )}
    </Stack>
  );
}
