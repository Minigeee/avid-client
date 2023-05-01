import { forwardRef, useEffect, useState } from 'react';

import {
  ActionIcon,
  Box,
  Button,
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
import { useForm } from '@mantine/form';
import { closeAllModals, ContextModalProps, openConfirmModal } from '@mantine/modals';

import { DotsVertical, FileDatabase, Hash, Trash } from 'tabler-icons-react';

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
  useMemo,
  useMemoState,
  useTask,
  useTasks,
} from '@/lib/hooks';
import {
  ExpandedTask,
  Member,
  Task,
  TaskPriority,
  TaskTag,
} from '@/lib/types';


////////////////////////////////////////////////////////////
const SHORT_INPUT_WIDTH = 40;
const MED_INPUT_WIDTH = 60;

const DEFAULT_TAG_COLOR = '#495057';


////////////////////////////////////////////////////////////
interface PriorityItemProps extends React.ComponentPropsWithoutRef<'div'> {
  value: number;
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
  return ({ value, label, color, onRemove, ...others }: MultiSelectValueProps & { value: string, color: string }) => {
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
}


////////////////////////////////////////////////////////////
type FormValues = {
  summary: string;
  description: string;
  status: string;
  priority: string;
  due_date: Date | null;
  tags: string[];
};


////////////////////////////////////////////////////////////
function tagToSelectItem(tag: TaskTag) {
  return {
    value: tag.id.toString(),
    label: tag.label,
    color: tag.color || DEFAULT_TAG_COLOR
  };
}

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
  const [createdTags, setCreatedTags] = useState<TaskTag[]>([]);
  const [tagColorOverrides, setTagColorOverrides] = useState<Record<string, string>>({});

  // Status data
  const statuses = useMemo<{ value: string, label: string, color: string }[]>(() => {
    return board?.statuses?.map((x, i) => ({ ...x, value: x.label }));
  }, []) || [];

  // Tags data
  const [tags, setTags] = useMemoState<{ value: string, label: string, color: string }[]>(() => {
    if (!board._exists) return [];

    // Get existing tags
    const existing = board.tags.map(tagToSelectItem);

    // Get created tags
    const created = createdTags.map(tagToSelectItem);

    // Combine them
    return existing.concat(created).sort((a, b) => a.label.localeCompare(b.label));
  }, []);


  return {
    createdTags, setCreatedTags,
    tagColorOverrides, setTagColorOverrides,
    statuses,
    tags, setTags
  };
}


async function updateTags(values: FormValues, created: TaskTag[], overrides: Record<string, string>, board: BoardWrapper) {
  let updatedTagIds = values.tags.map(x => parseInt(x));
  if (created.length > 0 || Object.keys(overrides).length > 0) {
    // Created tags with updated colors
    const updatedCreatedTags = created.map(x => ({ ...x, color: overrides[x.id] || x.color }));

    // Add all tags that changed colors (aren't newly created)
    const allChangedTags: Partial<TaskTag>[] = updatedCreatedTags.map(x => ({ label: x.label, color: x.color }));
    for (const [id, color] of Object.entries(overrides)) {
      const index = updatedCreatedTags.findIndex(x => x.id && x.id === parseInt(id));
      if (index < 0)
        allChangedTags.push({ id: parseInt(id), color });
    }

    // Update tags in server and get the new ones (with assigned ids)
    const newBoard = await board._mutators.addTags(allChangedTags);

    // Generate id map (maps old temp ids to new assigned ones)
    const newIdMap: Record<number, number | undefined> = {};
    for (const tag of updatedCreatedTags) {
      // Find the corresponding created tag in the new board
      const newTag = newBoard?.tags.find(x => x.label === tag.label && x.color === tag.color);

      // Add id to map
      newIdMap[tag.id] = newTag?.id;
    }

    // Update tag id list
    for (let i = 0; i < updatedTagIds.length; ++i) {
      const newId = newIdMap[updatedTagIds[i]];
      if (newId !== undefined)
        updatedTagIds[i] = newId;
    }
  }

  return updatedTagIds;
}


////////////////////////////////////////////////////////////
export type CreateTaskProps = {
  domain: DomainWrapper;
  board_id: string;
  /** Starting status */
  status?: string;
  /** Starting priority */
  priority?: number;
  /** Starting assignee */
  assignee?: Member;
  /** Starting tag */
  tag?: string;
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
      status: props.status || 'To Do',
      priority: props.priority?.toString() || TaskPriority.None.toString(),
      due_date: null,
      assignee: props.assignee || null,
      tags: props.tag !== undefined ? [props.tag] : [],
    } as FormValues,
  });

  const [loading, setLoading] = useState<boolean>(false);

  const {
    createdTags, setCreatedTags,
    tagColorOverrides, setTagColorOverrides,
    statuses,
    tags, setTags
  } = useTaskHooks(board);


  ////////////////////////////////////////////////////////////
  async function submit(values: FormValues) {
    if (!board._exists || !tasks._exists || !statuses) return;

    // Indicate loading
    setLoading(true);

    // Create new tags and update existing tag colors
    const updatedTagIds = await updateTags(values, createdTags, tagColorOverrides, board);

    // Create task and upload it
    const task = {
      ...values,
      priority: parseInt(values.priority),
      tags: updatedTagIds,
    };
    await tasks._mutators.addTask(task);

    setLoading(false);

    // Close
    context.closeModal(id);
  }


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

        {/* Add status colors */}
        <Select
          label='Status'
          data={statuses}
          icon={<ColorSwatch
            color={statuses?.find(x => x.value === form.values['status'])?.color || ''}
            size={16}
            mt={1}
          />}
          itemComponent={StatusSelectItem}
          sx={{ maxWidth: `${SHORT_INPUT_WIDTH}ch` }}
          {...form.getInputProps('status')}
        />

        <Select
          label='Priority'
          data={[
            { value: TaskPriority.Critical.toString(), label: 'Critical' },
            { value: TaskPriority.High.toString(), label: 'High' },
            { value: TaskPriority.Medium.toString(), label: 'Medium' },
            { value: TaskPriority.Low.toString(), label: 'Low' },
            { value: TaskPriority.None.toString(), label: 'None' },
          ]}
          icon={<TaskPriorityIcon
            priority={parseInt(form.values['priority'])}
            outerSize={19}
            innerSize={16}
            tooltip={false}
            sx={{ marginTop: 1 }}
          />}
          itemComponent={PrioritySelectItem}
          sx={{ maxWidth: `${SHORT_INPUT_WIDTH}ch` }}
          {...form.getInputProps('priority')}
        />

        <MemberInput
          domain_id={props.domain.id}
          label='Assignee'
          placeholder='Start typing to get a list of users'
          clearable
          sx={{ maxWidth: `${MED_INPUT_WIDTH}ch` }}
          {...form.getInputProps('assignee')}
        />

        <Divider />

        {/* TODO */}
        <MultiSelect
          label='Tags'
          description='Tags can be used to categorize tasks for easier searching and filtering. Click a tag to change its color'
          placeholder='Start typing to get a list of available tags or create a new one'
          searchable
          clearable
          creatable
          getCreateLabel={(query) => {
            // TODO : Make sure the tag want to create doesn't exist already
            return (
              <Box sx={{
                width: 'fit-content',
                padding: '1px 11px 2px 11px',
                backgroundColor: DEFAULT_TAG_COLOR,
                borderRadius: 15,
              }}>
                <Text size='xs' weight={500}>{query}</Text>
              </Box>
            );
          }}
          onCreate={(query) => {
            // Create new tag (id doesn't matter before tag is created)
            const item = {
              value: (1000000 - createdTags.length).toString(),
              label: query,
              color: DEFAULT_TAG_COLOR,
            };

            // Add to created list and tags list
            setTags([...(tags || []), item]);
            setCreatedTags([...createdTags, selectItemToTag(item)]);

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
          styles={{ wrapper: { maxWidth: `${MED_INPUT_WIDTH}ch` }, value: { margin: '3px 5px 3px 2px' } }}
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
      status: task.status || 'To Do',
      priority: task.priority !== undefined ? task.priority.toString() : TaskPriority.None.toString(),
      due_date: null,
      assignee: task.assignee || null,
      tags: task.tags?.map(x => x.toString()) || [],
    } as FormValues,
  });

  console.log(form.values.priority)

  const [inEditMode, setInEditMode] = useState<Record<'description' | 'summary', boolean>>({ description: false, summary: false });
  const [prevDesc, setPrevDesc] = useState<string>('');

  const {
    createdTags, setCreatedTags,
    tagColorOverrides, setTagColorOverrides,
    statuses,
    tags, setTags
  } = useTaskHooks(board);


  // Set description
  useEffect(() => {
    form.setFieldValue('description', task.description || '');
  }, [task._exists]);

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
                      <DotsVertical size={20} />
                    </ActionIcon>
                  </Menu.Target>

                  <Menu.Dropdown>
                    <Menu.Item
                      color='red'
                      icon={<Trash size={16} />}
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
                            sx: (theme) => ({
                              backgroundColor: theme.colors.red[6],
                              '&:hover': { backgroundColor: theme.colors.red[7] }
                            }),
                          },
                          onConfirm: () => {
                            if (!tasks._exists || !task._exists) return;
                            tasks._mutators.removeTask(task.id);
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
              getCreateLabel={(query) => {
                // TODO : Make sure the tag want to create doesn't exist already
                return (
                  <Box sx={{
                    width: 'fit-content',
                    padding: '1px 11px 2px 11px',
                    backgroundColor: DEFAULT_TAG_COLOR,
                    borderRadius: 15,
                  }}>
                    <Text size='xs' weight={500}>{query}</Text>
                  </Box>
                );
              }}
              onCreate={(query) => {
                // Create new tag (id doesn't matter before tag is created)
                const item = {
                  value: (1000000 - createdTags.length).toString(),
                  label: query,
                  color: DEFAULT_TAG_COLOR,
                };

                // Add to created list and tags list
                setTags([...(tags || []), item]);
                setCreatedTags([...createdTags, selectItemToTag(item)]);

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
              styles={{ wrapper: { maxWidth: `${MED_INPUT_WIDTH}ch` }, value: { margin: '3px 5px 3px 2px' } }}
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
              data={statuses}
              icon={<ColorSwatch
                color={statuses?.find(x => x.value === form.values['status'])?.color || ''}
                size={16}
                mt={1}
              />}
              itemComponent={StatusSelectItem}
              {...form.getInputProps('status')}
              onChange={(value) => {
                form.setFieldValue('status', value || 'To Do');
                onFieldChange({ status: value || '' });
              }}
            />

            <Select
              label='Priority'
              data={[
                { value: TaskPriority.Critical.toString(), label: 'Critical' },
                { value: TaskPriority.High.toString(), label: 'High' },
                { value: TaskPriority.Medium.toString(), label: 'Medium' },
                { value: TaskPriority.Low.toString(), label: 'Low' },
                { value: TaskPriority.None.toString(), label: 'None' },
              ]}
              icon={<TaskPriorityIcon
                priority={parseInt(form.values['priority'])}
                outerSize={19}
                innerSize={16}
                tooltip={false}
                sx={{ marginTop: 1 }}
              />}
              itemComponent={PrioritySelectItem}
              withinPortal
              {...form.getInputProps('priority')}
              onChange={(value) => {
                const v = value !== null ? value : TaskPriority.None.toString();
                form.setFieldValue('priority', v);
                onFieldChange({ priority: parseInt(v) });
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