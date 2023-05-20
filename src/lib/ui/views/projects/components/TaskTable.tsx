import { forwardRef, useEffect, useMemo, useState } from 'react';

import {
  ActionIcon,
  Box,
  Button,
  Checkbox,
  CheckboxProps,
  ColorSwatch,
  Group,
  Menu,
  Stack,
  Text,
  useMantineTheme,
} from '@mantine/core';
import { closeAllModals, openConfirmModal } from '@mantine/modals';

import {
  IconChevronDown,
  IconFolderSymlink,
  IconPlus,
  IconStatusChange,
  IconTrash,
  IconUserPlus
} from '@tabler/icons-react';

import { openCreateTask, openEditTask } from '@/lib/ui/modals';
import { CreateTaskProps } from '@/lib/ui/modals/CreateTask';
import { ContextMenu } from '@/lib/ui/components/ContextMenu';
import MemberAvatar from '@/lib/ui/components/MemberAvatar';
import MemberInput from '@/lib/ui/components/MemberInput';
import Submenu from '@/lib/ui/components/Submenu';
import TaskPriorityIcon from '@/lib/ui/components/TaskPriorityIcon';
import { GroupableFields } from '../BoardView';

import config from '@/config';
import {
  BoardWrapper,
  DomainWrapper,
  TasksWrapper,
  useMemoState,
} from '@/lib/hooks';
import { ExpandedTask, Label, Member } from '@/lib/types';

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
})


////////////////////////////////////////////////////////////
type ContextMenuData = {
  task: ExpandedTask | null;
};

////////////////////////////////////////////////////////////
type DataTableContextMenuProps = {
  board: BoardWrapper;
  domain: DomainWrapper;
  collection: string;
  tasksWrapper: TasksWrapper;
  
  statuses: Record<string, Label & { index: number }>;

  task: ExpandedTask | null;
};

////////////////////////////////////////////////////////////
function DataTableContextMenu({ board, task, ...props }: DataTableContextMenuProps) {
  const [assignee, setAssignee] = useState<Member | null>(task?.assignee || null);

  // Reset whenever task changes
  useEffect(() => {
    if (!task) return;
    setAssignee(task.assignee || null);
  }, [task?.id]);

  // Collection selections
  const collectionSelections = useMemo(() => {
    return board.collections.sort((a, b) =>
      a.end_date ?
        b.end_date ? new Date(b.end_date).getTime() - new Date(a.end_date).getTime() : 1 :
        b.end_date ? -1 : a.name.localeCompare(b.name)
    );
  }, [board.collections]);


  if (!task) {
    return null;
  }

  return (
    <>
      <Menu.Label>{board.prefix}-{task.sid}</Menu.Label>

      {board.collections.length > 1 && (
        <Submenu
          label='Move to'
          icon={<IconFolderSymlink size={16} />}
          dropdownProps={{
            sx: { minWidth: '15rem' },
          }}
        >
          {collectionSelections.map((c) => c.id !== props.collection ? (
            <Menu.Item onClick={() => props.tasksWrapper._mutators.updateTask(task.id, { collection: c.id }, true)}>
              <Stack spacing={6}>
                <Text inline weight={600} size='sm'>{c.name}</Text>
                {(c.start_date || c.end_date) && (
                  <Text inline size='xs' color='dimmed'>
                    {c.start_date ? moment(c.start_date).format('l') : ''} - {c.end_date ? moment(c.end_date).format('l') : ''}
                  </Text>
                )}
              </Stack>
            </Menu.Item>
          ) : null)}
        </Submenu>
      )}
      
      <Submenu
        label='Assign to'
        icon={<IconUserPlus size={16} />}
        dropdownProps={{
          p: 8,
          sx: { minWidth: '20rem' },
        }}
      >
        <MemberInput
          domain_id={props.domain.id}
          placeholder='Start typing to get a list of users'
          clearable
          withinPortal
          value={assignee}
          onChange={setAssignee}
        />

        <Button
          variant='gradient'
          fullWidth
          disabled={assignee?.id === task.assignee?.id}
          mt={16}
          onClick={() => props.tasksWrapper._mutators.updateTask(task.id, { assignee }, true)}
        >
          Assign
        </Button>
      </Submenu>

      <Menu.Divider />

      {task.status === 'todo' && (
        <Menu.Item
          icon={<ColorSwatch color={props.statuses['in-progress'].color || ''} size={16} />}
          onClick={() => props.tasksWrapper._mutators.updateTask(task.id, { status: 'in-progress' }, true)}
        >
          Mark as <b>{props.statuses['in-progress'].label}</b>
        </Menu.Item>
      )}
      {task.status === 'in-progress' && (
        <Menu.Item
          icon={<ColorSwatch color={props.statuses['completed'].color || ''} size={16} />}
          onClick={() => props.tasksWrapper._mutators.updateTask(task.id, { status: 'completed' }, true)}
        >
          Mark as <b>{props.statuses['completed'].label}</b>
        </Menu.Item>
      )}

      <Submenu
        label='Change status'
        icon={<IconStatusChange size={16} />}
        dropdownProps={{
          sx: { minWidth: '10rem' },
        }}
      >
        {Object.entries(props.statuses).map(([status_id, status]) => status_id !== task.status ? (
          <Menu.Item
            icon={<ColorSwatch color={status.color || ''} size={16} />}
            onClick={() => props.tasksWrapper._mutators.updateTask(task.id, { status: status_id }, true)}
          >
            {status.label}
          </Menu.Item>
        ) : null)}
      </Submenu>

      <Menu.Divider />
      <Menu.Item
        color='red'
        icon={<IconTrash size={16} />}
        onClick={() => {
          openConfirmModal({
            title: 'Delete Task',
            labels: { cancel: 'Cancel', confirm: 'Delete' },
            children: (
              <p>
                Are you sure you want to delete <b>{board.prefix}-{task.sid}</b>?
              </p>
            ),
            groupProps: {
              spacing: 'xs',
              sx: { marginTop: '0.5rem' },
            },
            confirmProps: {
              color: 'red',
            },
            onConfirm: () => {
              props.tasksWrapper._mutators.removeTask(task.id);
              closeAllModals();
            }
          })
        }}
      >
        Delete task
      </Menu.Item>
    </>
  );
}


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
};

////////////////////////////////////////////////////////////
export default function TaskTable({ board, tasks, ...props }: TaskTableProps) {
  const theme = useMantineTheme();

  // The task currently being hovered
  const [hovered, setHovered] = useState<ExpandedTask | null>(null);

  // Minimize times columns are reconstructed
  const columns = useMemo(() => ([
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
    },
  ] as TableColumn<ExpandedTask>[]), [
    board,
    props.domain,
    props.collection,
    props.groupingField,
    props.group,
    props.statuses,
    props.tags,
  ]);


  // Only display if tasks is array
  if (!Array.isArray(tasks)) return null;

  return (
    <ContextMenu
      width='15rem'
    >
      <ContextMenu.Dropdown>
        {({ task }: ContextMenuData) => task ? (
          <DataTableContextMenu
            board={board}
            domain={props.domain}
            collection={props.collection}
            tasksWrapper={props.tasksWrapper}
            statuses={props.statuses}

            task={task}
          />
        ) : null}
      </ContextMenu.Dropdown>

      <ContextMenu.Trigger
        context={{
          task: hovered
        } as ContextMenuData}
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
                color: theme.colors.dark[3],
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

          /* selectableRows
          // @ts-ignore
          selectableRowsComponent={CustomCheckbox}
          selectableRowsComponentProps={{ indeterminate: (indeterminate: boolean) => indeterminate }} */
        />
      </ContextMenu.Trigger>
    </ContextMenu>
  );
}