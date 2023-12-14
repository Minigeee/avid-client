import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';

import {
  ActionIcon,
  Box,
  BoxProps,
  Checkbox,
  CheckboxProps,
  Group,
  Text,
  Tooltip,
  useMantineTheme,
} from '@mantine/core';

import {
  IconChevronDown,
  IconGitMerge,
  IconPlus,
  IconSubtask,
} from '@tabler/icons-react';

import { openCreateTask, openEditTask } from '@/lib/ui/modals';
import { CreateTaskProps } from '@/lib/ui/modals/CreateTask';
import { ContextMenu } from '@/lib/ui/components/ContextMenu';
import MemberAvatar from '@/lib/ui/components/MemberAvatar';
import TaskPriorityIcon from '@/lib/ui/components/TaskPriorityIcon';
import MemberPopover from '@/lib/ui/components/MemberPopover';

import { GroupableFields } from '../BoardView';
import { TaskMenuContext, TaskMenuProps } from './TaskMenu';

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
import { merge } from 'lodash';

////////////////////////////////////////////////////////////
const CustomCheckbox = forwardRef((props: CheckboxProps, ref) => {
  return (
    <>
      <Checkbox
        {...props}
        size="xs"
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
  );
});
CustomCheckbox.displayName = 'CustomTaskTableCheckbox';

////////////////////////////////////////////////////////////
type TaskTableProps = {
  board: BoardWrapper;
  domain: DomainWrapper;
  /** A list of tasks that should be displayed in the table (this should be a subset of the tasks from the swr hook) */
  tasks: ExpandedTask[];
  /** The tasks wrapper, used for mutations */
  tasksWrapper: TasksWrapper;

  /** Currently chosen collection, used for the correctly configuring the create action */
  collection?: string;
  /** Currently chosen grouping field, used for the correctly configuring the create action */
  groupingField?: GroupableFields | null;
  /** The group this table is part of, used for the correctly configuring the create action */
  group?: string;

  /** Status map used to display status column */
  statuses?: Record<string, Label & { index: number }>;
  /** Tags map used to display tags column */
  tags?: Record<string, Label>;

  /** The columns that should be shown */
  columns?: (keyof ExpandedTask)[];
  /** Column overrides */
  columnOverrides?: Partial<
    Record<keyof ExpandedTask, TableColumn<ExpandedTask>>
  >;
  /** Custom action column */
  actionColumn?: TableColumn<ExpandedTask>;
  /** Indicates if the table should multi selectable */
  multiselectable?: boolean;
  /** Indicates if tasks can be created using table UI */
  creatable?: boolean;
  /** Extra components for no data component */
  noDataOverride?: JSX.Element;

  /** Props for wrapper object */
  wrapperProps?: BoxProps;
  /** Min header row height (default 52px) */
  headerHeight?: string;
  /** Min row height (default 48px) */
  rowHeight?: string;
};

////////////////////////////////////////////////////////////
export default function TaskTable({ board, tasks, ...props }: TaskTableProps) {
  const theme = useMantineTheme();
  const session = useSession();

  // Check if user can manage any task
  const canManageAny = hasPermission(
    props.domain,
    board.id,
    'can_manage_tasks',
  );

  // The task currently being hovered
  const [hovered, setHovered] = useState<ExpandedTask | null>(null);
  // Tasks that are selected
  const [selected, setSelected] = useState<ExpandedTask[]>([]);
  const [toggleCleared, setToggleCleared] = useState<boolean>(false);

  // Minimize times columns are reconstructed
  const columns = useMemo(() => {
    const order = props.columns || [
      'priority',
      'id',
      'summary',
      'status',
      'assignee',
      'due_date',
      'tags',
    ];
    const map = {
      priority: {
        name: 'Priority',
        center: true,
        grow: 0.5,
        width: '6rem',
        cell: (task: ExpandedTask) => (
          <TaskPriorityIcon
            priority={task.priority}
            outerSize={24}
            innerSize={18}
            sx={{}}
          />
        ),
        sortable: true,
        sortFunction: (a: ExpandedTask, b: ExpandedTask) =>
          (b.priority ? config.app.board.sort_keys.priority[b.priority] : 100) -
          (a.priority ? config.app.board.sort_keys.priority[a.priority] : 100),
      },
      id: {
        name: 'ID',
        grow: 1,
        style: { fontWeight: 600 },
        selector: (task: ExpandedTask) => `${board.prefix}-${task.sid}`,
        sortable: true,
        sortFunction: (a: ExpandedTask, b: ExpandedTask) => a.sid - b.sid,
      },
      summary: {
        name: 'Summary',
        grow: 8,
        cell: (task: ExpandedTask) => (
          <Group spacing={6} align="baseline">
            <Text span data-tag="allowRowEvents">
              {task.summary}
            </Text>
            {task.subtasks && task.subtasks.length > 0 && (
              <Tooltip
                label={`${task.subtasks.length} subtask${
                  task.subtasks.length > 1 ? 's' : ''
                }`}
                position="right"
                withArrow
                sx={(theme) => ({ backgroundColor: theme.colors.dark[8] })}
              >
                <Group
                  noWrap
                  spacing={1}
                  align="center"
                  sx={(theme) => ({
                    color: theme.colors.dark[2],
                    cursor: 'default',
                  })}
                >
                  <Text size="sm" data-tag="allowRowEvents">
                    {task.subtasks.length}
                  </Text>
                  <IconSubtask
                    data-tag="allowRowEvents"
                    size={15}
                    style={{ marginTop: '1px' }}
                  />
                </Group>
              </Tooltip>
            )}
            {task.dependencies && task.dependencies.length > 0 && (
              <Tooltip
                label={`${task.dependencies.length} dependenc${
                  task.dependencies.length > 1 ? 'ies' : 'y'
                }`}
                position="right"
                withArrow
                sx={(theme) => ({ backgroundColor: theme.colors.dark[8] })}
              >
                <Group
                  spacing={1}
                  align="center"
                  sx={(theme) => ({
                    color: theme.colors.dark[2],
                    cursor: 'default',
                  })}
                >
                  <Text size="sm">{task.dependencies.length}</Text>
                  <IconGitMerge size={15} style={{ marginTop: '1px' }} />
                </Group>
              </Tooltip>
            )}
          </Group>
        ),
      },
      status: props.statuses
        ? {
            name: 'Status',
            center: true,
            grow: 2,
            style: { fontWeight: 600, fontSize: 14 },
            cell: (task: ExpandedTask) => (
              <Text
                data-tag="allowRowEvents"
                sx={{
                  padding: '1px 13px 2px 11px',
                  width: 'fit-content',
                  maxWidth: 'calc(100% - 1.0rem)',
                  backgroundColor: props.statuses?.[task.status].color,
                  borderRadius: 3,
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
              >
                {props.statuses?.[task.status].label}
              </Text>
            ),
            sortable: true,
            sortFunction: (a: ExpandedTask, b: ExpandedTask) =>
              props.statuses
                ? props.statuses[a.status].index -
                  props.statuses[b.status].index
                : 0,
          }
        : undefined,
      assignee: {
        name: 'Assignee',
        center: true,
        grow: 1,
        cell: (task: ExpandedTask) =>
          task.assignee ? (
            <Box onClick={(ev) => ev.stopPropagation()}>
              <MemberPopover
                member={task.assignee}
                domain={props.domain}
                tooltip={task.assignee.alias}
                tooltipProps={{
                  position: 'left',
                  withArrow: true,
                  openDelay: 500,
                }}
              >
                <MemberAvatar member={task.assignee} size={32} />
              </MemberPopover>
            </Box>
          ) : undefined,
        sortable: true,
        sortFunction: (a: ExpandedTask, b: ExpandedTask) =>
          a.assignee?.alias.localeCompare(b.assignee?.alias || '') || -1,
      },
      due_date: {
        name: 'Due Date',
        grow: 2,
        style: { fontWeight: 500, fontSize: 13 },
        cell: (task: ExpandedTask) =>
          task.due_date ? (
            <Tooltip
              label={moment(task.due_date).format('ll')}
              position="right"
              withArrow
              sx={(theme) => ({
                backgroundColor: theme.colors.dark[8],
                fontWeight: 400,
              })}
            >
              <Text
                sx={(theme) => ({
                  padding: '1px 11px 2px 11px',
                  backgroundColor: theme.colors.dark[4],
                  borderRadius: 15,
                  cursor: 'default',
                })}
              >
                {moment(task.due_date).calendar({
                  sameDay: '[Today]',
                  nextDay: '[Tomorrow]',
                  nextWeek: 'dddd',
                  lastDay: '[Yesterday]',
                  lastWeek: 'l',
                  sameElse: 'l',
                })}
              </Text>
            </Tooltip>
          ) : undefined,
        sortable: true,
        sortFunction: (a: ExpandedTask, b: ExpandedTask) =>
          new Date(a.due_date || 0).getTime() -
          new Date(b.due_date || 0).getTime(),
      },
      tags: props.tags
        ? {
            name: 'Tags',
            grow: 3,
            cell: (task: ExpandedTask) => {
              if (!props.tags || !task.tags || task.tags.length === 0) return;

              // Prioritize tag group if grouping by tags
              let tags: string[];
              if (props.group && props.groupingField === 'tags')
                tags = [
                  props.group,
                  ...task.tags.filter((x) => x !== props.group).sort(),
                ];
              else tags = [...task.tags].sort();

              return (
                <Group spacing={6} mb={task.assignee ? 0 : 5}>
                  {tags.map((id, i) => {
                    const tag = props.tags?.[id];
                    if (!tag) return;

                    return (
                      <Box
                        key={id}
                        sx={{
                          padding: '1px 11px 2px 11px',
                          backgroundColor: tag.color,
                          borderRadius: 15,
                          cursor: 'default',
                        }}
                      >
                        <Text size="xs" weight={500}>
                          {tag.label}
                        </Text>
                      </Box>
                    );
                  })}
                </Group>
              );
            },
          }
        : undefined,
    } as Partial<Record<keyof ExpandedTask, TableColumn<ExpandedTask>>>;

    // Create array
    const cols = order
      .map((k) => merge(map[k], props.columnOverrides?.[k] || {}))
      .filter((x) => x) as TableColumn<ExpandedTask>[];

    // Action column
    if (props.actionColumn) {
      cols.push(props.actionColumn);
    }

    // Create button
    else if (props.creatable !== false) {
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
        width: '4rem',
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
    props.columns,
    props.columnOverrides,
    props.actionColumn,
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
      context={
        {
          task: hovered,
          selected: selected,
          onAction: onMenuAction,
        } as TaskMenuContext
      }
      disabled={
        (!hovered && !selected.length) ||
        (!canManageAny && hovered?.assignee?.id !== session.profile_id)
      }
      {...props.wrapperProps}
    >
      <DataTable
        customStyles={{
          table: {
            style: {
              maxWidth: '100%',
              borderRadius: '6px',
              backgroundColor: theme.colors.dark[8],
              color: theme.colors.dark[0],
            },
          },
          tableWrapper: {
            style: {
              display: 'block',
              maxWidth: '100%',
            },
          },
          headRow: {
            style: {
              minHeight: props.headerHeight || '3.25rem',
              fontSize: `${theme.fontSizes.sm}px`,
              fontWeight: 600,
              backgroundColor: 'transparent',
              color: theme.colors.dark[0],
              borderBottom: `1px solid ${theme.colors.dark[5]}`,
            },
          },
          rows: {
            style: {
              minHeight: props.rowHeight || '3rem',
              padding: '0.5rem 0rem',
              fontSize: `${theme.fontSizes.sm}px`,
              color: theme.colors.dark[0],
              backgroundColor: theme.colors.dark[7],
              borderTop: `1px solid ${theme.colors.dark[5]}`,
              borderBottom: `1px solid ${theme.colors.dark[5]}`,
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
        sortIcon={
          <IconChevronDown
            size={10}
            style={{ marginTop: '5px', marginLeft: '1px' }}
          />
        }
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
          if (hovered?.id === row.id) setHovered(null);
        }}
        pagination={tasks.length > 20}
        paginationPerPage={20}
        paginationComponentOptions={{
          noRowsPerPage: true,
        }}
        noDataComponent={
          props.noDataOverride || 'There are no tasks to display'
        }
        selectableRows={props.multiselectable !== false}
        // @ts-ignore
        selectableRowsComponent={CustomCheckbox}
        selectableRowsComponentProps={{
          indeterminate: (indeterminate: boolean) => indeterminate,
        }}
        onSelectedRowsChange={({ selectedRows }) => setSelected(selectedRows)}
        clearSelectedRows={toggleCleared}
      />
    </ContextMenu.Trigger>
  );
}
