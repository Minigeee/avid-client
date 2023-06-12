import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';

import {
  ActionIcon,
  Box,
  Checkbox,
  CheckboxProps,
  Group,
  Text,
  useMantineTheme,
} from '@mantine/core';

import {
  IconChevronDown,
  IconPlus,
} from '@tabler/icons-react';

import { openCreateTask, openEditTask } from '@/lib/ui/modals';
import { CreateTaskProps } from '@/lib/ui/modals/CreateTask';
import { ContextMenu } from '@/lib/ui/components/ContextMenu';
import MemberAvatar from '@/lib/ui/components/MemberAvatar';
import TaskPriorityIcon from '@/lib/ui/components/TaskPriorityIcon';

import { GroupableFields } from '../BoardView';
import { TaskMenuContext } from './TaskMenu';

import config from '@/config';
import {
  BoardWrapper,
  DomainWrapper,
  TasksWrapper,
  hasPermission,
  useSession,
} from '@/lib/hooks';
import { ExpandedTask, Label } from '@/lib/types';

import moment from 'moment';
import DataTable, { TableColumn } from 'react-data-table-component';


////////////////////////////////////////////////////////////
const CustomCheckbox = forwardRef((props: CheckboxProps, ref) => {
  return (
    <>
      <Checkbox
        {...props}
        size='xs'
        styles={(theme) => ({
          input: {
            cursor: 'pointer',
            '&:hover': {
              borderColor: theme.colors.dark[3],
            },
          },
        })}
      />
    </>
  )
});
CustomCheckbox.displayName = 'CustomTaskTableCheckbox';


////////////////////////////////////////////////////////////
type TaskTableProps = {
  board: BoardWrapper;
  domain: DomainWrapper;
  collection: string;
  tasks: ExpandedTask[];
  tasksWrapper: TasksWrapper;

  /** Currently chosen grouping field */
  groupingField: GroupableFields | null;
  /** The group this table is part of */
  group: string;

  statuses: Record<string, Label & { index: number }>;
  tags: Record<string, Label>;
  /** Indicates if tasks can be created using table UI */
  creatable?: boolean;
};

////////////////////////////////////////////////////////////
export default function TaskTable({ board, tasks, ...props }: TaskTableProps) {
  const theme = useMantineTheme();
  const session = useSession();

  // Check if user can manage any task
  const canManageAny = hasPermission(props.domain, board.id, 'can_manage_tasks');

  // The task currently being hovered
  const [hovered, setHovered] = useState<ExpandedTask | null>(null);
  // Tasks that are selected
  const [selected, setSelected] = useState<ExpandedTask[]>([]);
  const [toggleCleared, setToggleCleared] = useState<boolean>(false);

  // Minimize times columns are reconstructed
  const columns = useMemo(() => {
    const cols = [
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
          <Text data-tag='allowRowEvents' weight={600} size='sm' sx={{
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
        grow: 2,
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
                  <Box key={id} sx={{
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
    ] as TableColumn<ExpandedTask>[];

    // Create button
    if (props.creatable !== false) {
      cols.push({
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
                  collection: props.collection,
                  ...groupData,
                });
              }
            }}
          >
            <IconPlus size={19} />
          </ActionIcon>
        ),
        grow: 0,
        right: true,
      });
    }

    return cols;
  }, [
    board,
    props.domain,
    props.collection,
    props.groupingField,
    props.group,
    props.statuses,
    props.tags,
    props.creatable,
  ]);

  // Task menu action
  const onMenuAction = useCallback(() => {
    setToggleCleared(!toggleCleared);
    setSelected([]);
  }, [toggleCleared]);


  // Only display if tasks is array
  if (!Array.isArray(tasks)) return null;

  return (
    <ContextMenu.Trigger
      context={{
        task: hovered,
        selected: selected,
        onAction: onMenuAction,
      } as TaskMenuContext}
      disabled={(!hovered && !selected.length) || (!canManageAny && hovered?.assignee?.id !== session.profile_id)}
      style={{ marginBottom: '2.5rem' }}
    >
      <DataTable
        customStyles={{
          table: {
            style: {
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
          pagination: {
            style: {
              color: theme.colors.dark[0],
              fontSize: '13px',
              fontWeight: 600,
              minHeight: '3.0rem',
              backgroundColor: theme.colors.dark[8],
              borderTop: `solid 1px ${theme.colors.dark[5]}`,
              borderBottomLeftRadius: '6px',
              borderBottomRightRadius: '6px',
            },
            pageButtonsStyle: {
              borderRadius: '6px',
              height: '2.4rem',
              width: '2.4rem',
              cursor: 'pointer',
              transition: '0.18s',
              color: theme.colors.dark[1],
              fill: theme.colors.dark[1],
              backgroundColor: 'transparent',
              '&:disabled': {
                cursor: 'unset',
                color: theme.colors.dark[4],
                fill: theme.colors.dark[4],
              },
              '&:hover:not(:disabled)': {
                backgroundColor: theme.colors.dark[6],
              },
              '&:focus': {
                outline: 'none',
                backgroundColor: theme.colors.dark[6],
              },
            },
          },
          noData: {
            style: {
              height: '10rem',
              color: theme.colors.dark[2],
              backgroundColor: theme.colors.dark[8],
              borderRadius: 6,
            },
          },
        }}
        sortIcon={<IconChevronDown size={10} style={{ marginTop: '5px', marginLeft: '1px' }} />}

        columns={columns}
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
        onRowMouseEnter={setHovered}
        onRowMouseLeave={(row) => {
          if (hovered?.id === row.id)
            setHovered(null);
        }}

        pagination={tasks.length > 20}
        paginationPerPage={20}
        paginationComponentOptions={{
          noRowsPerPage: true,
        }}

        noDataComponent='There are no tasks to display'

        selectableRows
        // @ts-ignore
        selectableRowsComponent={CustomCheckbox}
        selectableRowsComponentProps={{ indeterminate: (indeterminate: boolean) => indeterminate }}
        onSelectedRowsChange={({ selectedRows }) => setSelected(selectedRows)}
        clearSelectedRows={toggleCleared}
      />
    </ContextMenu.Trigger>
  );
}