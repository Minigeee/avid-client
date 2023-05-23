import { forwardRef, useEffect, useMemo, useState } from 'react';

import {
  ActionIcon,
  Box,
  Button,
  Center,
  CloseButton,
  ColorPicker,
  ColorSwatch,
  DEFAULT_THEME,
  Divider,
  Grid,
  Group,
  MantineTheme,
  Menu,
  MultiSelect,
  MultiSelectValueProps,
  NumberInput,
  Popover,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { DatePickerInput, DatePickerInputProps } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { closeAllModals, ContextModalProps, openConfirmModal } from '@mantine/modals';

import {
  IconCalendarEvent,
  IconDotsVertical,
  IconFileDatabase,
  IconHash,
  IconTrash
} from '@tabler/icons-react';

import MemberInput from '@/lib/ui/components/MemberInput';
import RichTextEditor from '@/lib/ui/components/rte/RichTextEditor';
import TaskPriorityIcon from '@/lib/ui/components/TaskPriorityIcon';

import config from '@/config';
import {
  BoardWrapper,
  DomainWrapper,
  TasksWrapper,
  useBoard,
  useChatStyles,
  useMemoState,
  useTask,
  useTasks,
} from '@/lib/hooks';
import {
  ExpandedTask,
  Label,
  Member,
  TaskPriority,
  WithId,
} from '@/lib/types';

import moment from 'moment';
import { v4 as uuid } from 'uuid';
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
        <TaskPriorityIcon
          priority={value}
          tooltip={false}
        />
        <Text size='sm'>{label}</Text>
      </Group>
    </div>
  )
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
        <ColorSwatch
          color={color}
          size={18}
        />
        <Text size='sm'>{label}</Text>
      </Group>
    </div>
  )
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
      <Box sx={{
        width: 'fit-content',
        padding: '1px 11px 2px 11px',
        backgroundColor: color,
        borderRadius: 15,
      }}>
        <Text size='xs' weight={500}>{label}</Text>
      </Box>
    </div>
  )
);
TagSelectItem.displayName = 'TagSelectItem';

const PRESET_COLORS: string[] = [];
for (const [name, colors] of Object.entries(DEFAULT_THEME.colors)) {
  if (name === 'red' || name === 'gray' || name === 'yellow' || name === 'lime')
    PRESET_COLORS.push(colors[7]);
  else if (name !== 'dark')
    PRESET_COLORS.push(colors[6]);
}
PRESET_COLORS.push(DEFAULT_THEME.colors.gray[6]);

////////////////////////////////////////////////////////////
function TagSelectValue(onTagColorChange: (id: string, color: string) => void) {
  function TagSelectValueComponent({ value, label, color, onRemove, ...others }: MultiSelectValueProps & { value: string, color: string }) {
    const [tagColor, setTagColor] = useState<string>('');

    return (
      <div {...others}>
        <Popover
          position='top'
          withinPortal
          withArrow
          onClose={() => {
            if (tagColor)
              onTagColorChange(value, tagColor);
          }}
        >
          <Popover.Target>
            <UnstyledButton sx={{
              padding: '1px 5px 2px 11px',
              backgroundColor: tagColor || color,
              borderRadius: 15,
            }}>
              <Group
                spacing={2}
                align='end'
              >
                <Text size='xs' weight={500}>{label}</Text>
                <CloseButton
                  size={16}
                  iconSize={12.5}
                  variant='transparent'
                  tabIndex={-1}
                  onMouseDown={onRemove}
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
      label={(
        <Group spacing={6} align='baseline'>
          Due Date
          <Text color='dimmed' size='sm'>
            {(() => {
              if (!props.value) return '';
              const today = new Date();
              const diff = moment(props.value).diff([today.getFullYear(), today.getMonth(), today.getDate()], 'days');
              if (diff < 0)
                return '(Passed)';
              else if (diff === 0)
                return '(Today)';
              else if (diff === 1)
                return '(Tomorrow)';
              else
                return `(${diff} days)`;
            })()}
          </Text>
        </Group>
      )}
    />
  );
}


////////////////////////////////////////////////////////////
interface CollectionSelectItemProps extends React.ComponentPropsWithoutRef<'div'> {
  name: string;
  start_date?: string;
  end_date?: string;
}

////////////////////////////////////////////////////////////
const CollectionSelectItem = forwardRef<HTMLDivElement, CollectionSelectItemProps>(
  ({ name, start_date, end_date, ...others }: CollectionSelectItemProps, ref) => (
    <div ref={ref} {...others}>
      <Text weight={600}>{name}</Text>
      {(start_date || end_date) && (
        <Text size='xs' color='dimmed'>
          {start_date ? moment(start_date).format('l') : ''} - {end_date ? moment(end_date).format('l') : ''}
        </Text>
      )}
    </div>
  )
);
CollectionSelectItem.displayName = 'CollectionSelectItem';


////////////////////////////////////////////////////////////
type FormValues = {
  summary: string;
  description: string;
  status: string;
  priority: TaskPriority | null;
  due_date: Date | null;
  collection: string;
  tags: string[];
};


////////////////////////////////////////////////////////////
function selectItemToTag(item: { value: string, label: string, color: string }) {
  return {
    id: parseInt(item.value),
    label: item.label,
    color: item.color
  };
}


////////////////////////////////////////////////////////////
function useTaskHooks(board: BoardWrapper<false>) {
  const [createdTags, setCreatedTags] = useState<Record<string, WithId<Label>>>({});
  const [tagColorOverrides, setTagColorOverrides] = useState<Record<string, string>>({});

  // Tags data
  const [tags, setTags] = useMemoState<{ value: string, label: string, color?: string }[]>(() => {
    if (!board._exists) return [];

    // Get existing tags
    const existing = board.tags.map(x => ({ value: x.id, ...x }));

    // Get created tags
    const created = Object.entries(createdTags).map(x => ({ value: x[0], ...x[1] }));

    // Combine them
    return existing.concat(created).sort((a, b) => a.label.localeCompare(b.label));
  }, []);
  
  // Status map
  const statusMap = useMemo<Record<string, Label>>(() => {
    const map: Record<string, Label> = {};
    for (const status of (board.statuses || []))
      map[status.id] = status;
    return map;
  }, [board.statuses]);

  return {
    createdTags, setCreatedTags,
    tagColorOverrides, setTagColorOverrides,
    tags, setTags,
    statusMap,
  };
}


async function updateTags(values: FormValues, created: Record<string, Label>, overrides: Record<string, string>, board: BoardWrapper) {
  if (Object.keys(created).length > 0 || Object.keys(overrides).length > 0) {
    // Apply color overrides to created tags
    const createdTags: Record<string, Label> = {};
    for (const [k, v] of Object.entries(created))
      createdTags[k] = { ...v, color: overrides[k] || v.color };

    // Apply color overrides to existing tags
    const updatedTags: Record<string, WithId<Partial<Label>>> = {};
    for (const [id, color] of Object.entries(overrides)) {
      if (!createdTags[id])
        updatedTags[id] = { id, color };
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
      const newTag = newTags.find(x => x.label === v.label && x.color === v.color);

      // Add id to map
      assert(newTag !== undefined);
      newIdMap[k] = newTag.id;
    }

    // Return remapped tag id list
    return values.tags.map(id => newIdMap[id] || id);
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
}

////////////////////////////////////////////////////////////
export function CreateTask({ context, id, innerProps: props }: ContextModalProps<CreateTaskProps>) {
  const board = useBoard(props.board_id);
  const tasks = useTasks(props.board_id);

  // Create form
  const form = useForm({
    initialValues: {
      summary: '',
      description: '',
      status: props.status || config.app.board.default_status_id,
      priority: props.priority || null,
      due_date: props.due_date ? new Date(props.due_date) : null,
      assignee: props.assignee || null,
      collection: props.collection || config.app.board.default_backlog.id,
      tags: props.tag !== undefined ? [props.tag.trim()] : [],
    } as FormValues,
  });

  const [loading, setLoading] = useState<boolean>(false);

  const {
    createdTags, setCreatedTags,
    tagColorOverrides, setTagColorOverrides,
    tags, setTags,
    statusMap,
  } = useTaskHooks(board);


  ////////////////////////////////////////////////////////////
  async function submit(values: FormValues) {
    if (!board._exists || !tasks._exists) return;

    // Indicate loading
    setLoading(true);

    // Create new tags and update existing tag colors
    const updatedTagIds = await updateTags(values, createdTags, tagColorOverrides, board);

    // Create task and upload it
    const task = {
      ...values,
      due_date: values.due_date?.toISOString(),
      tags: updatedTagIds,
    };
    await tasks._mutators.addTask(task);

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
          <Text size='sm' weight={600} sx={{ marginBottom: 5 }}>Description</Text>
          <RichTextEditor
            domain={props.domain}
            {...form.getInputProps('description')}
          />
        </Box>

        <Divider />

        <Select
          label='Status'
          data={board.statuses.map(x => ({ value: x.id, ...x }))}
          icon={<ColorSwatch
            color={statusMap[form.values['status']]?.color || ''}
            size={16}
            mt={1}
          />}
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
          icon={<TaskPriorityIcon
            priority={form.values['priority']}
            outerSize={19}
            innerSize={16}
            tooltip={false}
            sx={{ marginTop: 1 }}
          />}
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
          label='Cycle'
          description='A cycle is a period of time during which a team works to complete a collection of tasks.'
          placeholder='None'
          data={board.collections.map(x => ({ value: x.id, label: x.name, ...x }))}
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
              <Box sx={{
                width: 'fit-content',
                padding: '1px 11px 2px 11px',
                backgroundColor: config.app.board.default_tag_color,
                borderRadius: 15,
              }}>
                <Text size='xs' weight={500}>{query}</Text>
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
            const index = copy.findIndex(x => x.value === value);
            copy[index] = { ...copy[index], color };
            setTags(copy);
          })}
          styles={{ wrapper: { maxWidth: config.app.ui.med_input_width }, value: { margin: '3px 5px 3px 2px' } }}
          {...form.getInputProps('tags')}
        />


        <Group spacing='xs' position='right'>
          <Button
            variant='default'
            onClick={() => context.closeModal(id)}
          >
            Cancel
          </Button>
          <Button
            variant='gradient'
            type='submit'
            loading={loading}
          >
            Create
          </Button>
        </Group>
      </Stack>
    </form>
  );
}



////////////////////////////////////////////////////////////
export type EditTaskProps = {
  board_id: string;
  board_prefix: string;
  domain: DomainWrapper;
  task: ExpandedTask;
}

////////////////////////////////////////////////////////////
export function EditTask({ context, id, innerProps: props }: ContextModalProps<EditTaskProps>) {
  const board = useBoard(props.board_id);
  const tasks = useTasks(props.board_id);
  const task = useTask(props.task.id, props.task);

  const { classes } = useChatStyles();
  const textEditStyle = (theme: MantineTheme) => ({
    padding: '0.2rem 0.45rem',
    marginLeft: '-0.45rem',
    borderRadius: 3,
    '&:hover': {
      backgroundColor: theme.colors.dark[6],
    },
  });

  // Create form
  const form = useForm({
    initialValues: {
      summary: task.summary,
      description: task.description || '',
      status: task.status || config.app.board.default_status_id,
      priority: task.priority || null,
      due_date: task.due_date ? new Date(task.due_date) : null,
      assignee: task.assignee || null,
      collection: task.collection || config.app.board.default_backlog.id,
      tags: task.tags?.map(x => x.toString()) || [],
    } as FormValues,
  });

  const [inEditMode, setInEditMode] = useState<Record<'description' | 'summary', boolean>>({ description: false, summary: false });
  const [prevDesc, setPrevDesc] = useState<string>('');

  const {
    createdTags, setCreatedTags,
    tagColorOverrides, setTagColorOverrides,
    tags, setTags,
    statusMap,
  } = useTaskHooks(board);


  // Set description
  useEffect(() => {
    form.setFieldValue('description', task.description || '');
  }, [task.description]);

  // Handle task field change
  async function onFieldChange(updates: Partial<ExpandedTask>) {
    if (!board._exists || !tasks._exists || !task._exists || !props.domain._exists) return;

    // Update the board
    await tasks._mutators.updateTask(task.id, updates);
    
    // Update local task
    const localUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates))
      localUpdates[key] = value === null ? undefined : value;
    await task._mutators.updateLocal(localUpdates);
  }


  if (!board._exists) return null;

  return (
    <Stack>
      <Grid gutter='xl'>
        <Grid.Col span={8}>
          <Stack spacing='xl'>
            {!inEditMode.summary && (
              <Group spacing='xs' noWrap>
                <Box sx={(sx) => ({ ...textEditStyle(sx), flexGrow: 1 })}>
                  <Tooltip
                    label='Click to edit'
                    position='left'
                    openDelay={500}
                    withArrow
                    sx={(theme) => ({ backgroundColor: theme.colors.dark[9] })}
                  >
                    <Title
                      order={3}
                      onClick={() => setInEditMode({ ...inEditMode, summary: true })}
                    >
                      {form.values.summary}
                    </Title>
                  </Tooltip>
                </Box>

                <Menu shadow='lg' width={200} position='bottom-end'>
                  <Menu.Target>
                    <ActionIcon size='lg' radius={3} sx={(theme) => ({ color: theme.colors.dark[1] })}>
                      <IconDotsVertical size={20} />
                    </ActionIcon>
                  </Menu.Target>

                  <Menu.Dropdown>
                    <Menu.Item
                      color='red'
                      icon={<IconTrash size={16} />}
                      onClick={() => {
                        openConfirmModal({
                          title: 'Delete Task',
                          labels: { cancel: 'Cancel', confirm: 'Delete' },
                          children: (
                            <p>
                              Are you sure you want to delete <b>{props.board_prefix}-{props.task.sid}</b>?
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
                            if (!tasks._exists || !task._exists) return;
                            tasks._mutators.removeTasks([task.id]);
                            closeAllModals();
                          }
                        })
                      }}
                    >
                      Delete task
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
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
                  }
                }}
              />
            )}

            <Stack spacing={5}>
              <Text size='sm' weight={600}>Description</Text>
              {!inEditMode.description && (
                <Tooltip
                  label='Click to edit'
                  position='left'
                  openDelay={500}
                  withArrow
                  sx={(theme) => ({ backgroundColor: theme.colors.dark[9] })}
                >
                  <Text
                    className={classes.typography}
                    size='sm'
                    sx={textEditStyle}
                    onClick={() => {
                      setPrevDesc(form.values.description.slice());
                      setInEditMode({ ...inEditMode, description: true });
                    }}
                    dangerouslySetInnerHTML={{ __html: form.values.description || '<i>Click to add description</i>' }}
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
                  <Box sx={{
                    width: 'fit-content',
                    padding: '1px 11px 2px 11px',
                    backgroundColor: config.app.board.default_tag_color,
                    borderRadius: 15,
                  }}>
                    <Text size='xs' weight={500}>{query}</Text>
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
                setTagColorOverrides({ ...tagColorOverrides, [value]: color });

                // Change actual tag color
                const copy = [...(tags || [])];
                const index = copy.findIndex(x => x.value === value);
                copy[index] = { ...copy[index], color };
                setTags(copy);
              })}
              styles={{ wrapper: { maxWidth: config.app.ui.med_input_width }, value: { margin: '3px 5px 3px 2px' } }}
              {...form.getInputProps('tags')}
              onBlur={async () => {
                if (!board._exists) return;
                
                // Only update tags when lose focus

                // Create new tags and update existing tag colors
                const updatedTagIds = await updateTags(form.values, createdTags, tagColorOverrides, board);

                // Update task
                if (form.isDirty('tags'))
                  await onFieldChange({ tags: updatedTagIds });
              }}
            />

          </Stack>
        </Grid.Col>
        <Grid.Col span={4} pl={16} pb={16} sx={(theme) => ({ borderLeft: `1px solid ${theme.colors.dark[5]}` })}>
          <Stack>

            <Select
              label='Status'
              data={board.statuses.map(x => ({ value: x.id, ...x }))}
              icon={<ColorSwatch
                color={statusMap[form.values['status']]?.color || ''}
                size={16}
                mt={1}
              />}
              itemComponent={StatusSelectItem}
              {...form.getInputProps('status')}
              onChange={(value) => {
                form.setFieldValue('status', value || config.app.board.default_status_id);
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
              icon={<TaskPriorityIcon
                priority={form.values['priority']}
                outerSize={19}
                innerSize={16}
                tooltip={false}
                sx={{ marginTop: 1 }}
              />}
              clearable
              itemComponent={PrioritySelectItem}
              withinPortal
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
              sx={{ maxWidth: config.app.ui.med_input_width }}
              {...form.getInputProps('due_date')}
              onChange={(value) => {
                form.setFieldValue('due_date', value);
                onFieldChange({ due_date: value?.toISOString() || null });
              }}
            />
            
            <Select
              label='Cycle'
              placeholder='None'
              withinPortal
              data={board.collections.map(x => ({ value: x.id, label: x.name, ...x }))}
              itemComponent={CollectionSelectItem}
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
        <Button
          variant='default'
          onClick={() => context.closeModal(id)}
        >
          Close
        </Button>
      </Group>
    </Stack>
  );
}