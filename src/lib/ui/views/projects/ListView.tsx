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
import { GroupableFields, NoGrouped, SingleGrouped } from './BoardView';

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
import assert from 'assert';
import TaskGroupAccordion from '../../components/TaskGroupAccordion';


////////////////////////////////////////////////////////////
const PRIORITY_LABELS = ['Critical', 'High', 'Medium', 'Low', 'None'];


////////////////////////////////////////////////////////////
type TaskTableProps = {
  board: BoardWrapper;
  domain: DomainWrapper;
  tasks: ExpandedTask[];

  /** Currently chosen grouping field */
  groupingField: GroupableFields | null;
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
            <TaskPriorityIcon priority={task.priority} outerSize={24} innerSize={18} sx={{}} />
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
          cell: (task: ExpandedTask) => {
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
  collection: string;

  filtered: NoGrouped | SingleGrouped;
  setFiltered: (filtered: NoGrouped | SingleGrouped) => any;
  grouper: GroupableFields | null;
}

////////////////////////////////////////////////////////////
export default function ListView({ board, filtered, grouper, ...props }: ListViewProps) {
  // Currently expanded fields per group by view
  const [expanded, setExpanded] = useState<Record<string, string[]>>({});
  // Memo this so it doesn't change every render
  const groups = useMemo<string[]>(() => Object.keys(filtered), [filtered]);


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


  return (
    <>
      {grouper && (
        <TaskGroupAccordion
          domain={props.domain}
          groups={groups}
          expanded={expanded}
          setExpanded={setExpanded}

          component={(group) => (
            <TaskTable
              board={board}
              domain={props.domain}
              tasks={(filtered as SingleGrouped)[group]}
              groupingField={grouper}
              group={group}
              statuses={statusMap}
              tags={tagMap}
            />
          )}

          tagMap={tagMap}
          collection={props.collection}
          grouper={grouper}
        />
      )}
      {!grouper && (
        <TaskTable
          board={board}
          domain={props.domain}
          tasks={filtered as NoGrouped}
          groupingField={grouper}
          group={''}
          statuses={statusMap}
          tags={tagMap}
        />
      )}
    </>
  );
}
