import { PropsWithChildren, useEffect, useMemo, useRef, useState } from 'react';

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
import { closeAllModals } from '@mantine/modals';

import {
  IconArrowsSort,
  IconChevronDown,
  IconFolderSymlink,
  IconGitMerge,
  IconPlus,
  IconStarFilled,
  IconStatusChange,
  IconSubtask,
  IconTrash,
  IconUserPlus,
} from '@tabler/icons-react';

import { openCreateTask, openEditTask } from '@/lib/ui/modals';
import { useConfirmModal } from '@/lib/ui/modals/ConfirmModal';
import { CreateTaskProps } from '@/lib/ui/modals/CreateTask';
import { ContextMenu } from '@/lib/ui/components/ContextMenu';
import MemberAvatar from '@/lib/ui/components/MemberAvatar';
import MemberInput from '@/lib/ui/components/MemberInput';
import TaskPriorityIcon from '@/lib/ui/components/TaskPriorityIcon';
import { GroupableFields } from '../BoardView';

import config from '@/config';
import {
  BoardWrapper,
  DomainWrapper,
  TasksWrapper,
  hasPermission,
  useMemoState,
} from '@/lib/hooks';
import { ExpandedTask, Label, Member, TaskPriority } from '@/lib/types';

import moment from 'moment';
import { capitalize } from 'lodash';
import { TaskSelector } from './TaskSelector';

////////////////////////////////////////////////////////////
const PRIORITIES: (TaskPriority | null)[] = [
  'critical',
  'high',
  'medium',
  'low',
  null,
];

////////////////////////////////////////////////////////////
export type TaskMenuContext = {
  /** The currently selected task that the context menu should show actions for */
  task: ExpandedTask | null;
  /** A list of selected tasks the context menu should show actions for */
  selected?: ExpandedTask[];
  /** Called after any action is taken. This overrides the callback provided by the main context menu. */
  onAction?: () => void;
};

////////////////////////////////////////////////////////////
export type TaskMenuProps = PropsWithChildren & {
  /** Used to get general board information */
  board: BoardWrapper;
  /** Used to modify task objects */
  tasks: TasksWrapper;

  /** Should be provided for domain related lookups (assignee) */
  domain?: DomainWrapper;
  /** The current collection being viewed. Should be provided to enable the "Move to" option */
  collection?: string;
  /** Map of existing statuses. Should be provided for status related actions */
  statuses?: Record<string, Label>;
  /** Defines the task's relation to another task. Should be provided to enable subtask or dependency related actions */
  relation?: {
    type: 'subtask' | 'dependency';
    task: ExpandedTask;
  };

  /** Called after any action is taken */
  onAction?: () => void;
};

////////////////////////////////////////////////////////////
type TaskMenuDropdownProps = Omit<TaskMenuProps, 'children'> & TaskMenuContext;

////////////////////////////////////////////////////////////
function TaskMenuDropdown({
  board,
  task,
  selected,
  ...props
}: TaskMenuDropdownProps) {
  const { open: openConfirmModal } = useConfirmModal();

  // Used to close menu for submenus that dont have dedicated button for it
  const subtaskCloseBtnRef = useRef<HTMLButtonElement>(null);
  const depCloseBtnRef = useRef<HTMLButtonElement>(null);

  const [assignee, setAssignee] = useState<Member | null>(
    task?.assignee || null,
  );
  const [origAssignee, setOrigAssignee] = useState<Member | null | undefined>(
    task?.assignee || null,
  );

  // Check if user can manage any
  const canManageAny = props.domain
    ? hasPermission(props.domain, board.id, 'can_manage_tasks')
    : false;

  // Reset whenever task changes
  useEffect(() => {
    let orig: Member | null | undefined = null;

    if (selected?.length) {
      // Choose one that all have
      orig = selected[0].assignee || null;
      for (let i = 1; i < selected.length; ++i) {
        if ((selected[i].assignee || null) !== orig) {
          orig = undefined;
          break;
        }
      }
    } else if (task) orig = task.assignee || null;

    setAssignee(orig || null);
    setOrigAssignee(orig);
  }, [task?.id]);

  // Collection selections
  const collectionSelections = useMemo(() => {
    return board.collections.sort((a, b) =>
      a.end_date
        ? b.end_date
          ? new Date(b.end_date).getTime() - new Date(a.end_date).getTime()
          : 1
        : b.end_date
          ? -1
          : a.name.localeCompare(b.name),
    );
  }, [board.collections]);

  // Update function
  function updateHandler(update: Partial<ExpandedTask>) {
    return () => {
      if (selected?.length)
        props.tasks._mutators.updateTasks(
          selected.map((x) => x.id),
          update,
          true,
        );
      else if (task) props.tasks._mutators.updateTask(task.id, update, true);

      // Callback
      props.onAction?.();
    };
  }

  if (!task && !selected?.length) return null;

  return (
    <>
      <Menu.Label>
        {selected?.length
          ? `${selected.length} SELECTED TASK${selected.length > 1 ? 'S' : ''}`
          : `${board.prefix}-${task?.sid}`}
      </Menu.Label>

      {props.collection && board.collections.length > 1 && (
        <ContextMenu.Submenu
          id='move-to'
          label='Move to'
          icon={<IconFolderSymlink size={16} />}
          dropdownProps={{
            sx: { minWidth: '15rem' },
          }}
        >
          {collectionSelections.map((c) => {
            const t = new Date();
            const current =
              c.start_date &&
              t >= new Date(c.start_date) &&
              (!c.end_date || t <= moment(c.end_date).add(1, 'day').toDate());

            return c.id !== props.collection ? (
              <Menu.Item
                key={c.id}
                onClick={updateHandler({ collection: c.id })}
              >
                <Stack spacing={6}>
                  <Group spacing={8} align='center'>
                    {current && <IconStarFilled size={16} />}
                    <Text inline weight={600} size='sm'>
                      {c.name}
                    </Text>
                  </Group>

                  {(c.start_date || c.end_date) && (
                    <Text inline size='xs' color='dimmed'>
                      {c.start_date ? moment(c.start_date).format('l') : ''} -{' '}
                      {c.end_date ? moment(c.end_date).format('l') : ''}
                    </Text>
                  )}
                </Stack>
              </Menu.Item>
            ) : null;
          })}
        </ContextMenu.Submenu>
      )}

      {props.domain && canManageAny && (
        <ContextMenu.Submenu
          id='assign-to'
          label='Assign to'
          icon={<IconUserPlus size={16} />}
          dropdownProps={{
            p: 16,
            sx: { minWidth: '20rem' },
          }}
        >
          <MemberInput
            domain_id={props.domain.id}
            placeholder='Start typing to get a list of users'
            clearable
            withinPortal
            dropdownPosition='top'
            value={assignee}
            onChange={setAssignee}
          />

          <Button
            variant='gradient'
            fullWidth
            disabled={
              origAssignee !== undefined && assignee?.id === origAssignee?.id
            }
            mt={16}
            // @ts-ignore
            onClick={updateHandler({ assignee })}
            component={Menu.Item}
          >
            Assign
          </Button>
        </ContextMenu.Submenu>
      )}

      <ContextMenu.Submenu
        id='change-priority'
        label='Change priority'
        icon={<IconArrowsSort size={16} />}
        dropdownProps={{
          sx: { minWidth: '10rem' },
        }}
      >
        {PRIORITIES.map((priority, i) =>
          (task?.priority || null) !== priority ? (
            <Menu.Item
              key={priority}
              icon={<TaskPriorityIcon priority={priority} tooltip={false} />}
              onClick={updateHandler({ priority })}
            >
              {capitalize(priority || 'none')}
            </Menu.Item>
          ) : null,
        )}
      </ContextMenu.Submenu>

      {props.statuses && (
        <>
          <Menu.Divider />

          {task && !selected?.length && (
            <>
              {task.status === 'todo' && (
                <Menu.Item
                  icon={
                    <ColorSwatch
                      color={props.statuses['in-progress'].color || ''}
                      size={16}
                    />
                  }
                  onClick={() =>
                    props.tasks._mutators.updateTask(
                      task.id,
                      { status: 'in-progress' },
                      true,
                    )
                  }
                >
                  Mark as <b>{props.statuses['in-progress'].label}</b>
                </Menu.Item>
              )}
              {task.status === 'in-progress' && (
                <Menu.Item
                  icon={
                    <ColorSwatch
                      color={props.statuses['completed'].color || ''}
                      size={16}
                    />
                  }
                  onClick={() =>
                    props.tasks._mutators.updateTask(
                      task.id,
                      { status: 'completed' },
                      true,
                    )
                  }
                >
                  Mark as <b>{props.statuses['completed'].label}</b>
                </Menu.Item>
              )}
            </>
          )}

          <ContextMenu.Submenu
            id='change-status'
            label='Change status'
            icon={<IconStatusChange size={16} />}
            dropdownProps={{
              sx: { minWidth: '10rem' },
            }}
          >
            {Object.entries(props.statuses).map(([status_id, status]) =>
              selected?.length || (task && status_id !== task.status) ? (
                <Menu.Item
                  key={status_id}
                  icon={<ColorSwatch color={status.color || ''} size={16} />}
                  onClick={updateHandler({ status: status_id })}
                >
                  {status.label}
                </Menu.Item>
              ) : null,
            )}
          </ContextMenu.Submenu>
        </>
      )}

      {task && (!selected || selected.length === 0) && props.domain && (
        <>
          <Menu.Divider />

          <ContextMenu.Submenu
            id='add-subtask'
            label='Add subtask'
            icon={<IconSubtask size={16} />}
            dropdownProps={{
              p: '1.0rem',
              sx: (theme) => ({
                boxShadow: '0px 0px 16px #00000030',
              }),
            }}
          >
            <TaskSelector
              type='subtask'
              domain={props.domain}
              board={board}
              tasks={props.tasks}
              task={task as ExpandedTask}
              onSelect={() => subtaskCloseBtnRef.current?.click()}
              buttonComponent={Menu.Item}
            />
            <Menu.Item ref={subtaskCloseBtnRef} sx={{ display: 'none' }} />
          </ContextMenu.Submenu>

          <ContextMenu.Submenu
            id='add-dependency'
            label='Add dependency'
            icon={<IconGitMerge size={16} />}
            dropdownProps={{
              p: '1.0rem',
              sx: (theme) => ({
                boxShadow: '0px 0px 16px #00000030',
              }),
            }}
          >
            <TaskSelector
              type='dependency'
              domain={props.domain}
              board={board}
              tasks={props.tasks}
              task={task as ExpandedTask}
              onSelect={() => depCloseBtnRef.current?.click()}
              buttonComponent={Menu.Item}
            />
            <Menu.Item ref={depCloseBtnRef} sx={{ display: 'none' }} />
          </ContextMenu.Submenu>
        </>
      )}

      <Menu.Divider />

      {task && props.relation?.type === 'subtask' && (
        <Menu.Item
          color='red'
          icon={<IconTrash size={16} />}
          onClick={() => {
            openConfirmModal({
              title: 'Remove Subtask',
              content: (
                <Text>
                  Are you sure you want to remove{' '}
                  <b>
                    {board.prefix}-{task.sid}
                  </b>{' '}
                  as a subtask of{' '}
                  <b>
                    {board.prefix}-{props.relation?.task.sid}
                  </b>
                  ?
                </Text>
              ),
              confirmLabel: 'Remove',
              onConfirm: () => {
                if (!props.relation) return;
                props.tasks._mutators.updateTask(
                  props.relation.task.id,
                  {
                    subtasks: props.relation.task.subtasks?.filter(
                      (id) => id !== task.id,
                    ),
                  },
                  true,
                );
              },
            });
          }}
        >
          Remove subtask
        </Menu.Item>
      )}

      {task && props.relation?.type === 'dependency' && (
        <Menu.Item
          color='red'
          icon={<IconTrash size={16} />}
          onClick={() => {
            openConfirmModal({
              title: 'Remove Dependency',
              content: (
                <Text>
                  Are you sure you want to remove{' '}
                  <b>
                    {board.prefix}-{task.sid}
                  </b>{' '}
                  as a dependency of{' '}
                  <b>
                    {board.prefix}-{props.relation?.task.sid}
                  </b>
                  ?
                </Text>
              ),
              confirmLabel: 'Remove',
              onConfirm: () => {
                if (!props.relation) return;
                props.tasks._mutators.updateTask(
                  props.relation.task.id,
                  {
                    dependencies: props.relation.task.dependencies?.filter(
                      (id) => id !== task.id,
                    ),
                  },
                  true,
                );
              },
            });
          }}
        >
          Remove dependency
        </Menu.Item>
      )}

      <Menu.Item
        color='red'
        icon={<IconTrash size={16} />}
        onClick={() => {
          openConfirmModal({
            title: 'Delete Task',
            confirmLabel: 'Delete',
            content: (
              <Text>
                Are you sure you want to delete{' '}
                <b>{selected?.length || `${board.prefix}-${task?.sid}`}</b>
                {selected?.length ? ' tasks' : ''}?
              </Text>
            ),
            onConfirm: () => {
              if (task || selected?.length)
                props.tasks._mutators.removeTasks(
                  selected?.length
                    ? selected.map((x) => x.id)
                    : [task?.id || ''],
                );
              closeAllModals();
            },
          });
        }}
      >
        Delete task
      </Menu.Item>
    </>
  );
}

////////////////////////////////////////////////////////////
export function TaskContextMenu(props: TaskMenuProps) {
  return (
    <ContextMenu width='15rem'>
      <ContextMenu.Dropdown
        dependencies={[
          props.board,
          props.tasks,
          props.domain,
          props.collection,
          props.statuses,
          props.relation,
          props.onAction,
        ]}
      >
        {(context: TaskMenuContext) => (
          <TaskMenuDropdown
            board={props.board}
            tasks={props.tasks}
            domain={props.domain}
            collection={props.collection}
            statuses={props.statuses}
            relation={props.relation}
            task={context.task}
            selected={context.selected}
            onAction={context.onAction || props.onAction}
          />
        )}
      </ContextMenu.Dropdown>

      {props.children}
    </ContextMenu>
  );
}
