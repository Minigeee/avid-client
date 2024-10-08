import {
  forwardRef,
  PropsWithChildren,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActionIcon,
  ActionIconProps,
  Box,
  Button,
  Center,
  CloseButton,
  ColorPicker,
  ColorSwatch,
  DEFAULT_THEME,
  Divider,
  Flex,
  Grid,
  Group,
  MantineTheme,
  Menu,
  MultiSelect,
  MultiSelectValueProps,
  NumberInput,
  Popover,
  Select,
  SelectProps,
  Spoiler,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { DatePickerInput, DatePickerInputProps } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { closeAllModals, ContextModalProps } from '@mantine/modals';

import {
  IconCalendarEvent,
  IconDotsVertical,
  IconFileDatabase,
  IconGitMerge,
  IconPlus,
  IconSearch,
  IconStarFilled,
  IconSubtask,
  IconTrash,
} from '@tabler/icons-react';

import { openEditTask } from '.';
import { useConfirmModal } from './ConfirmModal';
import { SubmenuProvider, Submenu } from '@/lib/ui/components/ContextMenu';
import MemberAvatar from '@/lib/ui/components/MemberAvatar';
import MemberInput from '@/lib/ui/components/MemberInput';
import RichTextEditor from '@/lib/ui/components/rte/RichTextEditor';
import TaskPriorityIcon from '@/lib/ui/components/TaskPriorityIcon';

import TaskTable from '@/lib/ui/views/projects/components/TaskTable';
import {
  TaskSelect,
  TaskSelector,
} from '@/lib/ui/views/projects/components/TaskSelector';
import { TaskContextMenu } from '@/lib/ui/views/projects/components/TaskMenu';

import config from '@/config';
import {
  BoardWrapper,
  DomainWrapper,
  getMemberSync,
  hasPermission,
  TasksWrapper,
  useBoard,
  useChatStyles,
  useMemoState,
  useSession,
  useTask,
  useTasks,
} from '@/lib/hooks';
import {
  ExpandedMember,
  ExpandedTask,
  Label,
  Member,
  TaskPriority,
  WithId,
} from '@/lib/types';

import moment from 'moment';
import { v4 as uuid } from 'uuid';
import deepEqual from 'fast-deep-equal';
import assert from 'assert';

////////////////////////////////////////////////////////////
interface PriorityItemProps extends React.ComponentPropsWithoutRef<'div'> {
  value: TaskPriority | null;
  label: string;
}

////////////////////////////////////////////////////////////
const PrioritySelectItem = forwardRef<HTMLDivElement, PriorityItemProps>(
  ({ value, label, ...others }: PriorityItemProps, ref) => (
    <div ref={ref} {...others}>
      <Group spacing='sm' noWrap>
        <TaskPriorityIcon priority={value} tooltip={false} />
        <Text size='sm'>{label}</Text>
      </Group>
    </div>
  ),
);
PrioritySelectItem.displayName = 'PrioritySelectItem';

////////////////////////////////////////////////////////////
interface StatusItemProps extends React.ComponentPropsWithoutRef<'div'> {
  value: number;
  label: string;
  color: string;
}

////////////////////////////////////////////////////////////
const StatusSelectItem = forwardRef<HTMLDivElement, StatusItemProps>(
  ({ label, color, ...others }: StatusItemProps, ref) => (
    <div ref={ref} {...others}>
      <Group spacing='sm' noWrap>
        <ColorSwatch color={color} size={18} />
        <Text size='sm'>{label}</Text>
      </Group>
    </div>
  ),
);
StatusSelectItem.displayName = 'StatusSelectItem';

////////////////////////////////////////////////////////////
interface TagItemProps extends React.ComponentPropsWithoutRef<'div'> {
  value: number;
  label: string;
  color: string;
}

////////////////////////////////////////////////////////////
const TagSelectItem = forwardRef<HTMLDivElement, TagItemProps>(
  ({ label, color, ...others }: TagItemProps, ref) => (
    <div ref={ref} {...others}>
      <Box
        sx={(theme) => ({
          width: 'fit-content',
          padding: '1px 11px 2px 11px',
          background: color,
          color: theme.colors.dark[0],
          borderRadius: 15,
        })}
      >
        <Text size='xs' weight={500} sx={(theme) => ({ color: theme.colors.dark[0] })}>
          {label}
        </Text>
      </Box>
    </div>
  ),
);
TagSelectItem.displayName = 'TagSelectItem';

const PRESET_COLORS: string[] = [];
for (const [name, colors] of Object.entries(DEFAULT_THEME.colors)) {
  if (name === 'red' || name === 'gray' || name === 'yellow' || name === 'lime')
    PRESET_COLORS.push(colors[7]);
  else if (name !== 'dark') PRESET_COLORS.push(colors[6]);
}
PRESET_COLORS.push(DEFAULT_THEME.colors.gray[6]);

////////////////////////////////////////////////////////////
function TagSelectValue(onTagColorChange: (id: string, color: string) => void) {
  function TagSelectValueComponent({
    value,
    label,
    color,
    onRemove,
    ...others
  }: MultiSelectValueProps & { value: string; color: string }) {
    const [tagColor, setTagColor] = useState<string>('');

    return (
      <div {...others}>
        <Popover
          position='top'
          withinPortal
          withArrow
          onClose={() => {
            if (tagColor) onTagColorChange(value, tagColor);
          }}
        >
          <Popover.Target>
            <UnstyledButton
              sx={(theme) => ({
                padding: '1px 5px 2px 11px',
                background: tagColor || color,
                borderRadius: 15,
              })}
            >
              <Group spacing={2} align='end'>
                <Text size='xs' weight={500} sx={(theme) => ({ color: theme.colors.dark[0] })}>
                  {label}
                </Text>
                <CloseButton
                  size={16}
                  iconSize={12.5}
                  variant='transparent'
                  tabIndex={-1}
                  onMouseDown={onRemove}
                  sx={(theme) => ({ color: theme.colors.dark[0] })}
                />
              </Group>
            </UnstyledButton>
          </Popover.Target>
          <Popover.Dropdown sx={{ padding: '1.0rem' }}>
            <ColorPicker
              swatchesPerRow={7}
              swatches={PRESET_COLORS}
              value={tagColor}
              onChange={setTagColor}
            />
          </Popover.Dropdown>
        </Popover>
      </div>
    );
  }

  return TagSelectValueComponent;
}

////////////////////////////////////////////////////////////
function DueDatePicker(props: DatePickerInputProps) {
  return (
    <DatePickerInput
      {...props}
      popoverProps={{ withinPortal: true }}
      label={
        <Group spacing={6} align='baseline'>
          Due Date
          <Text color='dimmed' size='sm'>
            {(() => {
              if (!props.value) return '';
              const today = new Date();
              const diff = moment(props.value).diff(
                [today.getFullYear(), today.getMonth(), today.getDate()],
                'days',
              );
              if (diff < 0) return '(Passed)';
              else if (diff === 0) return '(Today)';
              else if (diff === 1) return '(Tomorrow)';
              else return `(${diff} days)`;
            })()}
          </Text>
        </Group>
      }
    />
  );
}

////////////////////////////////////////////////////////////
interface CollectionSelectItemProps
  extends React.ComponentPropsWithoutRef<'div'> {
  name: string;
  start_date?: string;
  end_date?: string;
}

////////////////////////////////////////////////////////////
const CollectionSelectItem = forwardRef<
  HTMLDivElement,
  CollectionSelectItemProps
>(
  (
    { name, start_date, end_date, ...others }: CollectionSelectItemProps,
    ref,
  ) => {
    const t = new Date();
    const current =
      start_date &&
      t >= new Date(start_date) &&
      (!end_date || t <= moment(end_date).add(1, 'day').toDate());

    return (
      <div ref={ref} {...others}>
        <Group
          spacing={8}
          align='center'
          sx={(theme) => ({
            '.tabler-icon': {
              color: theme.other.colors.page_dimmed,
            },
          })}
        >
          {current && <IconStarFilled size={16} />}
          <Text weight={600}>{name}</Text>
        </Group>
        {(start_date || end_date) && (
          <Text size='xs' color='dimmed'>
            {start_date ? moment(start_date).format('l') : ''} -{' '}
            {end_date ? moment(end_date).format('l') : ''}
          </Text>
        )}
      </div>
    );
  },
);
CollectionSelectItem.displayName = 'CollectionSelectItem';

////////////////////////////////////////////////////////////
type FormValues = {
  id: string;
  summary: string;
  description: string;
  type: string;
  extra_task: string | null;
  status: string;
  priority: TaskPriority | null;
  due_date: Date | null;
  assignee: Member | null;
  collection: string;
  tags: string[];
  subtasks?: string[];
  dependencies?: string[];
};

////////////////////////////////////////////////////////////
function selectItemToTag(item: {
  value: string;
  label: string;
  color: string;
}) {
  return {
    id: parseInt(item.value),
    label: item.label,
    color: item.color,
  };
}

////////////////////////////////////////////////////////////
function useTaskHooks(board: BoardWrapper<false>) {
  const [createdTags, setCreatedTags] = useState<Record<string, WithId<Label>>>(
    {},
  );
  const [tagColorOverrides, setTagColorOverrides] = useState<
    Record<string, string>
  >({});

  // Tags data
  const [tags, setTags] = useMemoState<
    { value: string; label: string; color?: string }[]
  >(() => {
    if (!board._exists) return [];

    // Get existing tags
    const existing = board.tags.map((x) => ({ value: x.id, ...x }));

    // Get created tags
    const created = Object.entries(createdTags).map((x) => ({
      value: x[0],
      ...x[1],
    }));

    // Combine them
    return existing
      .concat(created)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  // Map of status
  const statusMap = useMemo(() => {
    if (!board._exists) return {};

    const map: Record<string, Label & { index: number }> = {};
    for (let i = 0; i < board.statuses.length; ++i)
      map[board.statuses[i].id] = { ...board.statuses[i], index: i };

    return map;
  }, [board.statuses]);

  // Map of tags
  const tagMap = useMemo(() => {
    if (!board._exists) return {};

    const map: Record<string, Label> = {};
    for (const tag of board.tags) map[tag.id] = tag;

    return map;
  }, [board.tags]);

  return {
    createdTags,
    setCreatedTags,
    tagColorOverrides,
    setTagColorOverrides,
    tags,
    setTags,
    statusMap,
    tagMap,
  };
}

async function updateTags(
  values: FormValues,
  created: Record<string, Label>,
  overrides: Record<string, string>,
  board: BoardWrapper,
) {
  if (Object.keys(created).length > 0 || Object.keys(overrides).length > 0) {
    // Apply color overrides to created tags
    const createdTags: Record<string, Label> = {};
    for (const [k, v] of Object.entries(created))
      createdTags[k] = { ...v, color: overrides[k] || v.color };

    // Apply color overrides to existing tags
    const updatedTags: Record<string, WithId<Partial<Label>>> = {};
    for (const [id, color] of Object.entries(overrides)) {
      if (!createdTags[id]) updatedTags[id] = { id, color };
    }

    // Update tags in server and get the new ones (with assigned ids)
    const newBoard = await board._mutators.addTags({
      add: Object.values(createdTags),
      update: Object.values(updatedTags),
    });

    // Generate id map (maps old temp ids to new assigned ones)
    const newTags = newBoard?.tags || [];
    const newIdMap: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(createdTags)) {
      // Find the corresponding created tag in the new board
      const newTag = newTags.find(
        (x) => x.label === v.label && x.color === v.color,
      );

      // Add id to map
      assert(newTag !== undefined);
      newIdMap[k] = newTag.id;
    }

    // Return remapped tag id list
    return values.tags.map((id) => newIdMap[id] || id);
  }

  return values.tags;
}

////////////////////////////////////////////////////////////
export type CreateTaskProps = {
  domain: DomainWrapper;
  board_id: string;
  /** Starting status */
  status?: string;
  /** Starting priority */
  priority?: TaskPriority;
  /** Starting assignee */
  assignee?: Member;
  /** Starting tag */
  tag?: string;
  /** Starting due date */
  due_date?: string;
  /** Starting collection */
  collection?: string;
  /** Task type */
  type?: 'task' | 'subtask' | 'dependency';
  /** Subtask or depenency */
  extra_task?: string;
};

////////////////////////////////////////////////////////////
export function CreateTask({
  context,
  id,
  innerProps: props,
}: ContextModalProps<CreateTaskProps>) {
  const session = useSession();
  const board = useBoard(props.board_id);
  const tasks = useTasks(props.board_id, props.domain.id);

  // Used to close menu
  const subtaskAddBtnRef = useRef<HTMLButtonElement>(null);
  const depAddBtnRef = useRef<HTMLButtonElement>(null);

  // Check if user can manage any task
  const canManageAny = hasPermission(
    props.domain,
    props.board_id,
    'can_manage_tasks',
  );

  // Create form
  const form = useForm({
    initialValues: {
      id: '',
      summary: '',
      description: '',
      type: props.type || 'task',
      extra_task: props.extra_task || null,
      status: props.status || config.app.board.default_status_id,
      priority: props.priority || null,
      due_date: props.due_date ? new Date(props.due_date) : null,
      assignee:
        props.assignee ||
        (canManageAny
          ? null
          : getMemberSync(props.domain.id, session.profile_id)),
      collection: props.collection || config.app.board.default_backlog.id,
      tags: props.tag !== undefined ? [props.tag.trim()] : [],
      subtasks: [],
      dependencies: [],
    } as FormValues,
  });

  // If create modal is loading
  const [loading, setLoading] = useState<boolean>(false);

  const {
    createdTags,
    setCreatedTags,
    tagColorOverrides,
    setTagColorOverrides,
    tags,
    setTags,
    statusMap,
  } = useTaskHooks(board);

  // Collection selections
  const collectionSelections = useMemo(() => {
    if (!board._exists) return [];

    const collections = board.collections.map((x) => ({
      value: x.id,
      label: x.name,
      ...x,
    }));
    return collections.sort((a, b) =>
      a.start_date
        ? b.start_date
          ? new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
          : 1
        : b.start_date
          ? -1
          : a.name.localeCompare(b.name),
    );
  }, [board.collections]);

  // Task map for lookups
  const tasksMap = useMemo(() => {
    const map: Record<string, ExpandedTask> = {};
    for (const t of tasks.data || []) map[t.id] = t;
    return map;
  }, [tasks.data]);

  // Get subtask objects
  const subtasks = useMemo(
    () => form.values.subtasks?.map((task_id) => tasksMap[task_id]) || [],
    [form.values.subtasks, tasksMap],
  );

  // Get dependency objects
  const dependencies = useMemo(
    () => form.values.dependencies?.map((task_id) => tasksMap[task_id]) || [],
    [form.values.dependencies, tasksMap],
  );

  // Tasks to exclude from task relation select
  const relationExcludeIds = useMemo(() => {
    if (
      !tasks._exists ||
      !form.values.type ||
      form.values.type === 'task' ||
      !form.values.extra_task
    )
      return;

    // Get extra task
    const extraTask = tasks.data.find(
      (task) => task.id === form.values.extra_task,
    );

    if (form.values.type === 'subtask') return extraTask?.subtasks || [];
    else if (form.values.type === 'dependency')
      return extraTask?.dependencies || [];
    else return [];
  }, [tasks._exists, form.values.type, form.values.extra_task]);

  // Subtask table action column
  const subtaskActionCol = useMemo(() => {
    if (!board._exists || !tasks._exists) return;
    return {
      name: (
        <Popover withArrow withinPortal shadow='lg' position='top'>
          <Popover.Target>
            <ActionIcon ref={subtaskAddBtnRef}>
              <IconPlus size={19} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown
            p={0}
            miw='20rem'
            onKeyDown={(e) => e.stopPropagation()}
          >
            <TaskSelector
              type='subtask'
              domain={props.domain}
              board={board}
              tasks={tasks}
              task={form.values}
              shouldUpdate={false}
              canCreateTask={false}
              onSelect={() => {
                subtaskAddBtnRef.current?.click();
              }}
            />
          </Popover.Dropdown>
        </Popover>
      ),
      cell: (subtask: ExpandedTask) => (
        <CloseButton
          size='md'
          onClick={() => {
            form.setFieldValue(
              'subtasks',
              form.values.subtasks?.filter((x) => x !== subtask.id),
            );
          }}
          sx={(theme) => ({
            '&:hover': {
              background: theme.other.colors.panel_hover,
            },
          })}
        />
      ),
      width: '4rem',
      right: true,
    };
  }, [board, tasks, form.values.subtasks]);

  // Dependency table action column
  const depActionCol = useMemo(() => {
    if (!board._exists || !tasks._exists) return;
    return {
      name: (
        <Popover withArrow withinPortal shadow='lg' position='top'>
          <Popover.Target>
            <ActionIcon ref={depAddBtnRef}>
              <IconPlus size={19} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown
            p={0}
            miw='20rem'
            onKeyDown={(e) => e.stopPropagation()}
          >
            <TaskSelector
              type='dependency'
              domain={props.domain}
              board={board}
              tasks={tasks}
              task={form.values}
              shouldUpdate={false}
              canCreateTask={false}
              onSelect={() => depAddBtnRef.current?.click()}
            />
          </Popover.Dropdown>
        </Popover>
      ),
      cell: (dependency: ExpandedTask) => (
        <CloseButton
          size='md'
          onClick={() => {
            form.setFieldValue(
              'dependencies',
              form.values.dependencies?.filter((x) => x !== dependency.id),
            );
          }}
          sx={(theme) => ({
            '&:hover': {
              background: theme.other.colors.panel_hover,
            },
          })}
        />
      ),
      width: '4rem',
      right: true,
    };
  }, [board, tasks, form.values.dependencies]);

  // Set base assignee if needed (can only manage own tasks)
  useEffect(() => {
    if (!canManageAny && !form.values.assignee) {
      const member = getMemberSync(props.domain.id, session.profile_id);
      form.setFieldValue('assignee', member);
    }
  }, []);

  ////////////////////////////////////////////////////////////
  async function submit(values: FormValues) {
    if (!board._exists || !tasks._exists) return;

    // Indicate loading
    setLoading(true);

    // Create new tags and update existing tag colors
    const updatedTagIds = await updateTags(
      values,
      createdTags,
      tagColorOverrides,
      board,
    );

    // Create task and upload it
    const task = {
      ...values,
      id: undefined,
      due_date: values.due_date?.toISOString(),
      tags: updatedTagIds,
      type: undefined,
      extra_task: undefined,
    };
    const newTasks = await tasks._mutators.addTask(task);

    // Find new task
    const newTask = newTasks?.findLast((t) => t.summary === values.summary);
    const extraTask =
      values.extra_task && newTasks
        ? newTasks.find((t) => t.id === values.extra_task)
        : undefined;

    // Update other tasks with subtask/dependency
    if (newTask && extraTask) {
      if (values.type === 'subtask')
        await tasks._mutators.updateTask(extraTask.id, {
          subtasks: [...(extraTask.subtasks || []), newTask.id],
        });
      else if (values.type === 'dependency')
        await tasks._mutators.updateTask(extraTask.id, {
          dependencies: [...(extraTask.dependencies || []), newTask.id],
        });
    }

    setLoading(false);

    // Close
    context.closeModal(id);
  }

  if (!board._exists) return null;

  ////////////////////////////////////////////////////////////
  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack>
        <TextInput
          label='Summary'
          placeholder='Short task summary'
          required
          data-autofocus
          {...form.getInputProps('summary')}
        />

        <Box>
          <Text size='sm' weight={600} sx={{ marginBottom: 5 }}>
            Description
          </Text>
          <RichTextEditor
            domain={props.domain}
            {...form.getInputProps('description')}
          />
        </Box>

        {/* <Select
          label='Type'
          description='Choose whether this should be a regular task, a subtask, or a dependency task'
          data={[
            { value: 'task', label: 'Task' },
            { value: 'subtask', label: 'Subtask' },
            { value: 'dependency', label: 'Dependency' },
          ]}
          {...form.getInputProps('type')}
          sx={{ maxWidth: config.app.ui.med_input_width }}
        /> */}

        {tasks._exists && form.values.type !== 'task' && (
          <TaskSelect
            required
            label={
              form.values.type === 'subtask' ? 'Parent Task' : 'Dependent Task'
            }
            description={
              form.values.type === 'subtask'
                ? 'Select the parent task for this task'
                : 'Select the task that is dependent on the completion of this task'
            }
            placeholder='Select a task'
            board={board}
            tasks={tasks}
            exclude_ids={relationExcludeIds}
            {...form.getInputProps('extra_task')}
            sx={{ maxWidth: config.app.ui.med_input_width }}
          />
        )}

        <Divider />

        <Select
          label='Status'
          data={board.statuses.map((x) => ({ value: x.id, ...x }))}
          icon={
            <ColorSwatch
              color={statusMap[form.values['status']]?.color || ''}
              size={16}
              mt={1}
            />
          }
          itemComponent={StatusSelectItem}
          sx={{ maxWidth: config.app.ui.short_input_width }}
          {...form.getInputProps('status')}
        />

        <Select
          label='Priority'
          placeholder='None'
          data={[
            { value: 'critical', label: 'Critical' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
          ]}
          icon={
            <TaskPriorityIcon
              priority={form.values['priority']}
              outerSize={19}
              innerSize={16}
              tooltip={false}
              sx={{ marginTop: 1 }}
            />
          }
          clearable
          itemComponent={PrioritySelectItem}
          sx={{ maxWidth: config.app.ui.short_input_width }}
          {...form.getInputProps('priority')}
        />

        <MemberInput
          domain_id={props.domain.id}
          label='Assignee'
          placeholder='Start typing to get a list of users'
          clearable
          disabled={!canManageAny}
          sx={{ maxWidth: config.app.ui.med_input_width }}
          {...form.getInputProps('assignee')}
        />

        <DueDatePicker
          placeholder='None'
          icon={<IconCalendarEvent size={19} />}
          clearable
          sx={{ maxWidth: config.app.ui.med_input_width }}
          {...form.getInputProps('due_date')}
        />

        <Divider />

        <Select
          label='Collection'
          description='Assign a task collection or objective'
          placeholder='None'
          data={collectionSelections}
          itemComponent={CollectionSelectItem}
          sx={{ maxWidth: config.app.ui.med_input_width }}
          {...form.getInputProps('collection')}
        />

        <MultiSelect
          label='Tags'
          description='Tags can be used to categorize tasks for easier searching and filtering. Click a tag to change its color'
          placeholder='Start typing to get a list of available tags or create a new one'
          searchable
          clearable
          creatable
          withinPortal
          getCreateLabel={(query) => {
            return (
              <Box
                sx={{
                  width: 'fit-content',
                  padding: '1px 11px 2px 11px',
                  background: config.app.board.default_tag_color,
                  borderRadius: 15,
                }}
              >
                <Text size='xs' weight={500}>
                  {query}
                </Text>
              </Box>
            );
          }}
          onCreate={(query) => {
            // Create new tag (id doesn't matter before tag is created)
            const id = uuid();
            const tag: WithId<Label> = {
              id,
              label: query,
              color: config.app.board.default_tag_color,
            };
            const item = { value: id, ...tag };

            // Add to created list and tags list
            setTags([...(tags || []), item]);
            setCreatedTags({ ...createdTags, [id]: tag });

            return item;
          }}
          data={tags || []}
          itemComponent={TagSelectItem}
          valueComponent={TagSelectValue((value, color) => {
            // Add to overrides list
            setTagColorOverrides({ ...tagColorOverrides, [value]: color });

            // Change actual tag color
            const copy = tags.slice();
            const index = copy.findIndex((x) => x.value === value);
            copy[index] = { ...copy[index], color };
            setTags(copy);
          })}
          styles={{
            wrapper: { maxWidth: config.app.ui.med_input_width },
            value: { margin: '3px 5px 3px 2px' },
          }}
          {...form.getInputProps('tags')}
        />

        <Divider />

        {tasks._exists && (
          <Stack mb={8}>
            {(!form.values.subtasks?.length ||
              !form.values.dependencies?.length) && (
              <Group>
                {!form.values.subtasks?.length && (
                  <Popover withArrow withinPortal shadow='lg' position='top'>
                    <Popover.Target>
                      <Button
                        ref={subtaskAddBtnRef}
                        variant='default'
                        leftIcon={<IconSubtask size={16} />}
                      >
                        Add subtask
                      </Button>
                    </Popover.Target>
                    <Popover.Dropdown
                      p={0}
                      miw='20rem'
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <TaskSelector
                        type='subtask'
                        domain={props.domain}
                        board={board}
                        tasks={tasks}
                        task={form.values}
                        shouldUpdate={false}
                        canCreateTask={false}
                        onSelect={(task_id) => {
                          form.setFieldValue('subtasks', [
                            ...(form.values.subtasks || []),
                            task_id,
                          ]);
                          subtaskAddBtnRef.current?.click();
                        }}
                      />
                    </Popover.Dropdown>
                  </Popover>
                )}

                {!form.values.dependencies?.length && (
                  <Popover withArrow withinPortal shadow='lg' position='top'>
                    <Popover.Target>
                      <Button
                        ref={depAddBtnRef}
                        variant='default'
                        leftIcon={<IconGitMerge size={16} />}
                      >
                        Add dependency
                      </Button>
                    </Popover.Target>
                    <Popover.Dropdown
                      p={0}
                      miw='20rem'
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <TaskSelector
                        type='dependency'
                        domain={props.domain}
                        board={board}
                        tasks={tasks}
                        task={form.values}
                        shouldUpdate={false}
                        canCreateTask={false}
                        onSelect={(task_id) => {
                          form.setFieldValue('dependencies', [
                            ...(form.values.dependencies || []),
                            task_id,
                          ]);
                          depAddBtnRef.current?.click();
                        }}
                      />
                    </Popover.Dropdown>
                  </Popover>
                )}
              </Group>
            )}

            <TaskContextMenu
              board={board}
              tasks={tasks}
              domain={props.domain}
              statuses={statusMap}
            >
              {form.values.subtasks && form.values.subtasks.length > 0 && (
                <Box>
                  <Text size='sm' weight={600} mb={6}>
                    Subtasks
                  </Text>
                  <TaskTable
                    board={board}
                    domain={props.domain}
                    statuses={statusMap}
                    tasks={subtasks}
                    tasksWrapper={tasks}
                    columns={TASK_COLUMNS}
                    columnOverrides={TASK_COLUMN_OVERRIDES}
                    actionColumn={subtaskActionCol}
                    creatable={false}
                    multiselectable={false}
                    headerHeight='3rem'
                    rowHeight='2.75rem'
                  />
                </Box>
              )}

              {form.values.dependencies &&
                form.values.dependencies.length > 0 && (
                  <Box>
                    <Text size='sm' weight={600} mb={6}>
                      Dependencies
                    </Text>
                    <TaskTable
                      board={board}
                      domain={props.domain}
                      statuses={statusMap}
                      tasks={dependencies}
                      tasksWrapper={tasks}
                      columns={TASK_COLUMNS}
                      columnOverrides={TASK_COLUMN_OVERRIDES}
                      actionColumn={depActionCol}
                      creatable={false}
                      multiselectable={false}
                      headerHeight='3rem'
                      rowHeight='2.75rem'
                    />
                  </Box>
                )}
            </TaskContextMenu>
          </Stack>
        )}

        <Group spacing='xs' position='right'>
          <Button variant='default' onClick={() => context.closeModal(id)}>
            Cancel
          </Button>
          <Button variant='gradient' type='submit' loading={loading}>
            Create
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

////////////////////////////////////////////////////////////
const TASK_COLUMNS = [
  'id',
  'summary',
  'status',
  'assignee',
] as (keyof ExpandedTask)[];

////////////////////////////////////////////////////////////
const TASK_COLUMN_OVERRIDES = {
  priority: {
    cell: (task: ExpandedTask) => (
      <TaskPriorityIcon
        priority={task.priority}
        outerSize={22}
        innerSize={18}
        sx={{}}
      />
    ),
  },
  id: {
    style: { fontSize: 14 },
  },
  summary: {
    style: { fontSize: 14 },
  },
  status: {
    style: { fontSize: 13 },
  },
};

////////////////////////////////////////////////////////////
type TaskDropdownProps = {
  board_id: string;
  board_prefix: string;
  domain: DomainWrapper;
  tasks: ExpandedTask[];
  statusMap: Record<string, Label>;

  icon: JSX.Element;
  tooltip: (len: number) => string;
};

////////////////////////////////////////////////////////////
function TaskDropdown({ tasks, ...props }: TaskDropdownProps) {
  return (
    <Menu>
      <Tooltip label={props.tooltip(tasks.length)} position='right' withArrow>
        <Menu.Target>
          <ActionIcon
            sx={(theme) => ({ color: theme.other.colors.page_dimmed })}
          >
            <Text span size='sm'>
              {tasks.length}
            </Text>
            {props.icon}
          </ActionIcon>
        </Menu.Target>
      </Tooltip>

      <Menu.Dropdown miw='15rem' maw='20rem'>
        {tasks.map((t) => (
          <Menu.Item
            key={t.id}
            onClick={() => {
              openEditTask({
                board_id: props.board_id,
                board_prefix: props.board_prefix,
                domain: props.domain,
                task: t,
              });
            }}
          >
            <Flex gap='sm' wrap='nowrap'>
              <Box sx={{ flexGrow: 1 }}>
                <Group spacing={8}>
                  <ColorSwatch
                    size={16}
                    color={props.statusMap[t.status].color || ''}
                  />
                  <Text size='sm' weight={600}>
                    {props.board_prefix}-{t.sid}
                  </Text>
                </Group>
                <Text size='xs' color='dimmed'>
                  {t.summary}
                </Text>
              </Box>

              {t.assignee && <MemberAvatar member={t.assignee} size={32} />}
            </Flex>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

////////////////////////////////////////////////////////////
export type EditTaskProps = {
  board_id: string;
  board_prefix: string;
  domain: DomainWrapper;
  task: ExpandedTask;
};

////////////////////////////////////////////////////////////
export function EditTask({
  context,
  id,
  innerProps: props,
}: ContextModalProps<EditTaskProps>) {
  const session = useSession();
  const board = useBoard(props.board_id);
  const tasks = useTasks(props.board_id, props.domain.id);
  const task = useTask(props.task.id, props.task);

  const { open: openConfirmModal } = useConfirmModal();

  // Used to close menu
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const subtaskAddBtnRef = useRef<HTMLButtonElement>(null);
  const depAddBtnRef = useRef<HTMLButtonElement>(null);

  // Check if task is editable
  const canManageAny = hasPermission(
    props.domain,
    props.board_id,
    'can_manage_tasks',
  );
  const editable =
    canManageAny ||
    (hasPermission(props.domain, props.board_id, 'can_manage_own_tasks') &&
      task.assignee?.id === session.profile_id);

  const { classes } = useChatStyles();
  const textEditStyle = (theme: MantineTheme) => ({
    padding: '0.2rem 0.45rem',
    marginLeft: '-0.45rem',
    borderRadius: 3,
    '&:hover': editable
      ? {
          background: theme.other.colors.page_hover,
        }
      : undefined,
  });

  // Create form
  const form = useForm({
    initialValues: {
      id: task.id,
      summary: task.summary,
      description: task.description || '',
      status: task.status || config.app.board.default_status_id,
      priority: task.priority || null,
      due_date: task.due_date ? new Date(task.due_date) : null,
      assignee: task.assignee || null,
      collection: task.collection || config.app.board.default_backlog.id,
      tags: task.tags?.map((x) => x.toString()) || [],
    } as FormValues,
  });

  const [inEditMode, setInEditMode] = useState<
    Record<'description' | 'summary', boolean>
  >({ description: false, summary: false });
  const [prevTitle, setPrevTitle] = useState<string>('');
  const [prevDesc, setPrevDesc] = useState<string>('');

  const {
    createdTags,
    setCreatedTags,
    tagColorOverrides,
    setTagColorOverrides,
    tags,
    setTags,
    statusMap,
    tagMap,
  } = useTaskHooks(board);

  // Set description
  useEffect(() => {
    if (form.values.description !== task.description)
      form.setFieldValue('description', task.description || '');
  }, [task.description]);

  // Collection selections
  const collectionSelections = useMemo(() => {
    if (!board._exists) return [];

    const collections = board.collections.map((x) => ({
      value: x.id,
      label: x.name,
      ...x,
    }));
    return collections.sort((a, b) =>
      a.start_date
        ? b.start_date
          ? new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
          : 1
        : b.start_date
          ? -1
          : a.name.localeCompare(b.name),
    );
  }, [board.collections]);

  // Subtasks
  const subtasks = useMemo(() => {
    if (!tasks._exists) return [];
    const set = new Set<string>(task.subtasks);
    if (!set.size) return [];

    return tasks.data.filter((x) => set.has(x.id));
  }, [task.subtasks]);

  // Dependencies
  const dependencies = useMemo(() => {
    if (!tasks._exists) return [];
    const set = new Set<string>(task.dependencies);
    if (!set.size) return [];

    return tasks.data.filter((x) => set.has(x.id));
  }, [task.dependencies]);

  // Relations to other tasks not recorded in this task (dependents and parent tasks)
  const relations = useMemo(() => {
    const relations = {
      parents: [] as ExpandedTask[],
      dependents: [] as ExpandedTask[],
    };
    if (!tasks._exists) return relations;

    for (const t of tasks.data) {
      if (t.subtasks?.includes(props.task.id)) relations.parents.push(t);
      if (t.dependencies?.includes(props.task.id)) relations.dependents.push(t);
    }

    return relations;
  }, [props.task.id, tasks]);

  // Handle task field change
  async function onFieldChange(updates: Partial<ExpandedTask>) {
    if (
      !board._exists ||
      !tasks._exists ||
      !task._exists ||
      !props.domain._exists
    )
      return;

    // Update the board
    await tasks._mutators.updateTask(task.id, updates);

    // Update local task
    const localUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates))
      localUpdates[key] = value === null ? undefined : value;
    await task._mutators.updateLocal(localUpdates);
  }

  // Subtask table action column
  const subtaskActionCol = useMemo(() => {
    if (!board._exists || !tasks._exists || !editable) return;
    return {
      name: (
        <Popover withArrow withinPortal shadow='lg'>
          <Popover.Target>
            <ActionIcon ref={subtaskAddBtnRef}>
              <IconPlus size={19} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown
            p={0}
            miw='20rem'
            onKeyDown={(e) => e.stopPropagation()}
          >
            <TaskSelector
              type='subtask'
              domain={props.domain}
              board={board}
              tasks={tasks}
              task={task as ExpandedTask}
              onSelect={() => subtaskAddBtnRef.current?.click()}
            />
          </Popover.Dropdown>
        </Popover>
      ),
      cell: (subtask: ExpandedTask) => (
        <CloseButton
          size='md'
          sx={(theme) => ({
            '&:hover': {
              background: theme.other.colors.panel_hover,
            },
          })}
          onClick={() =>
            openConfirmModal({
              title: 'Remove Subtask',
              content: (
                <Text>
                  Are you sure you want to remove{' '}
                  <b>
                    {props.board_prefix}-{subtask.sid}
                  </b>{' '}
                  as a subtask of{' '}
                  <b>
                    {props.board_prefix}-{task.sid}
                  </b>
                  ?
                </Text>
              ),
              confirmLabel: 'Remove',
              onConfirm: () => {
                tasks._mutators.updateTask(
                  props.task.id,
                  {
                    subtasks: task.subtasks?.filter((id) => id !== subtask.id),
                  },
                  true,
                );
              },
            })
          }
        />
      ),
      width: '4rem',
      right: true,
    };
  }, [board, tasks, task.subtasks]);

  // Dependency table action column
  const depActionCol = useMemo(() => {
    if (!board._exists || !tasks._exists || !editable) return;
    return {
      name: (
        <Popover withArrow withinPortal shadow='lg'>
          <Popover.Target>
            <ActionIcon ref={depAddBtnRef}>
              <IconPlus size={19} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown
            p={0}
            miw='20rem'
            onKeyDown={(e) => e.stopPropagation()}
          >
            <TaskSelector
              type='dependency'
              domain={props.domain}
              board={board}
              tasks={tasks}
              task={task as ExpandedTask}
              onSelect={() => depAddBtnRef.current?.click()}
            />
          </Popover.Dropdown>
        </Popover>
      ),
      cell: (dependency: ExpandedTask) => (
        <CloseButton
          size='md'
          sx={(theme) => ({
            '&:hover': {
              background: theme.other.colors.panel_hover,
            },
          })}
          onClick={() =>
            openConfirmModal({
              title: 'Remove Dependency',
              content: (
                <Text>
                  Are you sure you want to remove{' '}
                  <b>
                    {props.board_prefix}-{dependency.sid}
                  </b>{' '}
                  as a dependency of{' '}
                  <b>
                    {props.board_prefix}-{task.sid}
                  </b>
                  ?
                </Text>
              ),
              confirmLabel: 'Remove',
              onConfirm: () => {
                tasks._mutators.updateTask(
                  props.task.id,
                  {
                    dependencies: task.dependencies?.filter(
                      (id) => id !== dependency.id,
                    ),
                  },
                  true,
                );
              },
            })
          }
        />
      ),
      width: '4rem',
      right: true,
    };
  }, [board, tasks, task.dependencies]);

  if (!board._exists) return null;

  return (
    <Stack>
      <Grid gutter='xl'>
        <Grid.Col span={8}>
          <Stack spacing='1.75rem'>
            <Box>
              {!inEditMode.summary && (
                <Group spacing='xs' noWrap>
                  <Box sx={(sx) => ({ ...textEditStyle(sx), flexGrow: 1 })}>
                    <Tooltip
                      label='Click to edit'
                      position='left'
                      openDelay={500}
                      withArrow
                      disabled={!editable}
                    >
                      <Title
                        order={3}
                        onClick={
                          editable
                            ? () => {
                                setPrevTitle(form.values.summary.slice());
                                setInEditMode({ ...inEditMode, summary: true });
                              }
                            : undefined
                        }
                      >
                        {form.values.summary}
                      </Title>
                    </Tooltip>
                  </Box>

                  {editable && (
                    <SubmenuProvider
                      shadow='lg'
                      width='15rem'
                      position='bottom-end'
                      withinPortal
                    >
                      <Menu.Target>
                        <ActionIcon
                          size='lg'
                          radius={3}
                          sx={(theme) => ({
                            color: theme.other.colors.page_dimmed,
                          })}
                        >
                          <IconDotsVertical size={20} />
                        </ActionIcon>
                      </Menu.Target>

                      <Menu.Dropdown onKeyDown={(e) => e.stopPropagation()}>
                        {tasks._exists && (
                          <>
                            <Submenu
                              id='add-subtask'
                              label='Add Subtask'
                              icon={<IconSubtask size={16} />}
                              dropdownProps={{
                                p: '0rem',
                                miw: '20rem',
                              }}
                            >
                              <TaskSelector
                                type='subtask'
                                domain={props.domain}
                                board={board}
                                tasks={tasks}
                                task={task as ExpandedTask}
                                onSelect={() => closeBtnRef.current?.click()}
                              />
                              <Menu.Item
                                ref={closeBtnRef}
                                sx={{ display: 'none' }}
                              />
                            </Submenu>

                            <Submenu
                              id='add-dependency'
                              label='Add Dependency'
                              icon={<IconGitMerge size={16} />}
                              dropdownProps={{
                                p: '0rem',
                                miw: '20rem',
                              }}
                            >
                              <TaskSelector
                                type='dependency'
                                domain={props.domain}
                                board={board}
                                tasks={tasks}
                                task={task as ExpandedTask}
                                onSelect={() => closeBtnRef.current?.click()}
                              />
                              <Menu.Item
                                ref={closeBtnRef}
                                sx={{ display: 'none' }}
                              />
                            </Submenu>
                          </>
                        )}

                        <Menu.Divider />

                        <Menu.Item
                          color='red'
                          icon={<IconTrash size={16} />}
                          onClick={() => {
                            openConfirmModal({
                              title: 'Delete Task',
                              content: (
                                <Text>
                                  Are you sure you want to delete{' '}
                                  <b>
                                    {props.board_prefix}-{props.task.sid}
                                  </b>
                                  ?
                                </Text>
                              ),
                              confirmLabel: 'Delete',
                              onConfirm: () => {
                                if (!tasks._exists || !task._exists) return;
                                tasks._mutators.removeTasks([task.id]);
                                closeAllModals();
                              },
                            });
                          }}
                        >
                          Delete task
                        </Menu.Item>
                      </Menu.Dropdown>
                    </SubmenuProvider>
                  )}
                </Group>
              )}
              {inEditMode.summary && (
                <TextInput
                  placeholder='Short task summary'
                  autoFocus
                  {...form.getInputProps('summary')}
                  onBlur={() => {
                    onFieldChange({ summary: form.values.summary });
                    setInEditMode({ ...inEditMode, summary: false });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onFieldChange({ summary: form.values.summary });
                      setInEditMode({ ...inEditMode, summary: false });
                    } else if (e.key === 'Escape') {
                      form.setFieldValue('summary', prevTitle);
                      setInEditMode({ ...inEditMode, summary: false });
                      e.stopPropagation();
                    }
                  }}
                />
              )}

              <Group spacing={4}>
                {relations.parents.length > 0 && (
                  <TaskDropdown
                    {...props}
                    tasks={relations.parents}
                    icon={
                      <IconSubtask
                        size={15}
                        style={{ marginTop: 1, marginLeft: 1 }}
                      />
                    }
                    tooltip={(len) =>
                      `${len} parent task${len !== 1 ? 's' : ''}`
                    }
                    statusMap={statusMap}
                  />
                )}
                {relations.dependents.length > 0 && (
                  <TaskDropdown
                    {...props}
                    tasks={relations.dependents}
                    icon={
                      <IconGitMerge
                        size={15}
                        style={{ marginTop: 1, marginLeft: 1 }}
                      />
                    }
                    tooltip={(len) =>
                      `${len} dependent task${len !== 1 ? 's' : ''}`
                    }
                    statusMap={statusMap}
                  />
                )}
              </Group>
            </Box>

            <Stack spacing={5}>
              <Text size='sm' weight={600}>
                Description
              </Text>
              {!inEditMode.description && (
                <Tooltip
                  label='Click to edit'
                  position='left'
                  openDelay={500}
                  withArrow
                  disabled={!editable}
                >
                  <Text
                    className={classes.typography}
                    size='sm'
                    sx={textEditStyle}
                    onClick={
                      editable
                        ? () => {
                            setPrevDesc(form.values.description.slice());
                            setInEditMode({ ...inEditMode, description: true });
                          }
                        : undefined
                    }
                    dangerouslySetInnerHTML={{
                      __html:
                        form.values.description ||
                        (editable
                          ? '<i>Click to add description</i>'
                          : '<i>No description</i>'),
                    }}
                  />
                </Tooltip>
              )}
              {inEditMode.description && (
                <>
                  <RichTextEditor
                    domain={props.domain}
                    autofocus
                    {...form.getInputProps('description')}
                  />
                  <Group spacing='xs' position='right' mt={6}>
                    <Button
                      variant='default'
                      onClick={() => {
                        form.setFieldValue('description', prevDesc);
                        setInEditMode({ ...inEditMode, description: false });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant='gradient'
                      onClick={() => {
                        onFieldChange({ description: form.values.description });
                        setInEditMode({ ...inEditMode, description: false });
                      }}
                    >
                      Save
                    </Button>
                  </Group>
                </>
              )}
            </Stack>

            {tasks._exists && (
              <>
                {task.subtasks && task.subtasks.length > 0 && (
                  <TaskContextMenu
                    board={board}
                    tasks={tasks}
                    domain={props.domain}
                    statuses={statusMap}
                    relation={
                      task._exists ? { type: 'subtask', task: task } : undefined
                    }
                  >
                    <Box>
                      <Text size='sm' weight={600} mb={6}>
                        Subtasks
                      </Text>
                      <TaskTable
                        board={board}
                        domain={props.domain}
                        statuses={statusMap}
                        tags={tagMap}
                        tasks={subtasks}
                        tasksWrapper={tasks}
                        columns={TASK_COLUMNS}
                        columnOverrides={TASK_COLUMN_OVERRIDES}
                        actionColumn={subtaskActionCol}
                        creatable={false}
                        multiselectable={false}
                        headerHeight='3rem'
                        rowHeight='2.75rem'
                      />
                    </Box>
                  </TaskContextMenu>
                )}

                {task.dependencies && task.dependencies.length > 0 && (
                  <TaskContextMenu
                    board={board}
                    tasks={tasks}
                    domain={props.domain}
                    statuses={statusMap}
                    relation={
                      task._exists
                        ? { type: 'dependency', task: task }
                        : undefined
                    }
                  >
                    <Box>
                      <Text size='sm' weight={600} mb={6}>
                        Dependencies
                      </Text>
                      <TaskTable
                        board={board}
                        domain={props.domain}
                        statuses={statusMap}
                        tags={tagMap}
                        tasks={dependencies}
                        tasksWrapper={tasks}
                        columns={TASK_COLUMNS}
                        columnOverrides={TASK_COLUMN_OVERRIDES}
                        actionColumn={depActionCol}
                        creatable={false}
                        multiselectable={false}
                        headerHeight='3rem'
                        rowHeight='2.75rem'
                      />
                    </Box>
                  </TaskContextMenu>
                )}
              </>
            )}

            {editable && (
              <MultiSelect
                label='Tags'
                placeholder='Start typing to get a list of available tags or create a new one'
                searchable
                clearable
                creatable
                withinPortal
                getCreateLabel={(query) => {
                  // TODO : Make sure the tag want to create doesn't exist already
                  return (
                    <Box
                      sx={(theme) => ({
                        width: 'fit-content',
                        padding: '1px 11px 2px 11px',
                        background: config.app.board.default_tag_color,
                        color: theme.colors.dark[0],
                        borderRadius: 15,
                      })}
                    >
                      <Text size='xs' weight={500}>
                        {query}
                      </Text>
                    </Box>
                  );
                }}
                onCreate={(query) => {
                  // Create new tag (id doesn't matter before tag is created)
                  const id = uuid();
                  const tag = {
                    id,
                    label: query,
                    color: config.app.board.default_tag_color,
                  };
                  const item = { value: id, ...tag };

                  // Add to created list and tags list
                  setTags([...(tags || []), item]);
                  setCreatedTags({ ...createdTags, [id]: tag });

                  return item;
                }}
                data={tags || []}
                itemComponent={TagSelectItem}
                valueComponent={TagSelectValue((value, color) => {
                  // Add to overrides list
                  setTagColorOverrides({
                    ...tagColorOverrides,
                    [value]: color,
                  });

                  // Change actual tag color
                  const copy = [...(tags || [])];
                  const index = copy.findIndex((x) => x.value === value);
                  copy[index] = { ...copy[index], color };
                  setTags(copy);
                })}
                styles={{
                  wrapper: { maxWidth: config.app.ui.med_input_width },
                  value: { margin: '3px 5px 3px 2px' },
                }}
                {...form.getInputProps('tags')}
                onBlur={async () => {
                  if (!board._exists) return;

                  // Only update tags when lose focus

                  // Create new tags and update existing tag colors
                  const updatedTagIds = await updateTags(
                    form.values,
                    createdTags,
                    tagColorOverrides,
                    board,
                  );

                  // Update task
                  if (form.isDirty('tags'))
                    await onFieldChange({ tags: updatedTagIds });
                }}
              />
            )}
            {!editable && task.tags && task.tags.length > 0 && (
              <div>
                <Text size='sm' weight={600} mb={9}>
                  Tags
                </Text>

                <Group spacing={6} mb={task.assignee ? 0 : 5}>
                  {task.tags?.map((id, i) => {
                    const tag = tags?.find((x) => x.value === id);
                    if (!tag) return;

                    return (
                      <Box
                        key={id}
                        sx={{
                          padding: '1px 11px 2px 11px',
                          background: tag.color,
                          borderRadius: 15,
                          cursor: 'default',
                        }}
                      >
                        <Text size='xs' weight={500}>
                          {tag.label}
                        </Text>
                      </Box>
                    );
                  })}
                </Group>
              </div>
            )}
          </Stack>
        </Grid.Col>
        <Grid.Col
          span={4}
          pl={16}
          pb={16}
          sx={(theme) => ({
            borderLeft: `1px solid ${theme.other.colors.page_border}`,
          })}
        >
          <Stack>
            <Select
              label='Status'
              data={board.statuses.map((x) => ({ value: x.id, ...x }))}
              icon={
                <ColorSwatch
                  color={statusMap[form.values['status']]?.color || ''}
                  size={16}
                  mt={1}
                />
              }
              itemComponent={StatusSelectItem}
              disabled={!editable}
              {...form.getInputProps('status')}
              onChange={(value) => {
                form.setFieldValue(
                  'status',
                  value || config.app.board.default_status_id,
                );
                onFieldChange({ status: value || '' });
              }}
            />

            <Select
              label='Priority'
              placeholder='None'
              data={[
                { value: 'critical', label: 'Critical' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
              icon={
                <TaskPriorityIcon
                  priority={form.values['priority']}
                  outerSize={19}
                  innerSize={16}
                  tooltip={false}
                  sx={{ marginTop: 1 }}
                />
              }
              clearable
              itemComponent={PrioritySelectItem}
              withinPortal
              disabled={!editable}
              {...form.getInputProps('priority')}
              onChange={(value: TaskPriority | null) => {
                form.setFieldValue('priority', value);
                onFieldChange({ priority: value });
              }}
            />

            <MemberInput
              domain_id={props.domain.id}
              label='Assignee'
              placeholder='Start typing to get a list of users'
              clearable
              withinPortal
              disabled={!canManageAny}
              {...form.getInputProps('assignee')}
              onChange={(value) => {
                form.setFieldValue('assignee', value);
                onFieldChange({ assignee: value });
              }}
            />

            <DueDatePicker
              placeholder='None'
              icon={<IconCalendarEvent size={19} />}
              clearable
              disabled={!editable}
              {...form.getInputProps('due_date')}
              onChange={(value) => {
                form.setFieldValue('due_date', value);
                onFieldChange({ due_date: value?.toISOString() || null });
              }}
            />

            <Select
              label='Collection'
              placeholder='None'
              withinPortal
              data={collectionSelections}
              itemComponent={CollectionSelectItem}
              disabled={!editable}
              {...form.getInputProps('collection')}
              onChange={(value) => {
                const v = value || config.app.board.default_status_id;
                form.setFieldValue('collection', v);
                onFieldChange({ collection: v });
              }}
            />
          </Stack>
        </Grid.Col>
      </Grid>
      <Group spacing='xs' position='right'>
        <Button variant='default' onClick={() => context.closeModal(id)}>
          Close
        </Button>
      </Group>
    </Stack>
  );
}
