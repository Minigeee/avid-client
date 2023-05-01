import { useState } from 'react';

import {
  ActionIcon,
  Box,
  Button,
  ColorSwatch,
  Divider,
  Flex,
  Group,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';

import {
  ChevronDown,
  GitMerge,
  Plus,
  Search,
  Subtask,
  Tag,
} from 'tabler-icons-react';

import MemberAvatar from '@/lib/ui/components/MemberAvatar';
import TaskPriorityIcon from '@/lib/ui/components/TaskPriorityIcon';
import TaskTagsSelector from '@/lib/ui/components/TaskTagsSelector';
import { openCreateTask, openEditTask } from '@/lib/ui/modals';

import config from '@/config';
import {
  BoardWrapper,
  DomainWrapper,
  TasksWrapper,
  useMemo,
  useMemoState,
} from '@/lib/hooks';
import { ExpandedTask, Task, TaskTag } from '@/lib/types';

import { groupBy, round } from 'lodash';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';


////////////////////////////////////////////////////////////
type TaskCardProps = {
  task: ExpandedTask;
  prefix: string;

  tags?: Record<string, TaskTag>;

  index: number;
  onClick: () => unknown,
}

////////////////////////////////////////////////////////////
function TaskCard({ task, prefix, tags, ...props }: TaskCardProps) {
  return (
    <Draggable draggableId={task.id.toString()} index={props.index}>
      {(provided) => (
        <Stack
          ref={provided.innerRef}
          spacing={6}
          sx={(theme) => ({
            padding: '0.7rem 0.8rem',
            marginBottom: 9,
            backgroundColor: theme.colors.dark[6],
            borderRadius: 3,
            boxShadow: '0px 0px 10px #00000033',
          })}
          onClick={props.onClick}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <Group spacing={6}>
            <Text size={15} weight={600} sx={(theme) => ({ color: theme.colors.violet[0], marginRight: 4 })}>
              {prefix}-{task.sid}
            </Text>

            {task.subtasks && task.subtasks.length > 0 && (
              <Tooltip
                label={`${task.subtasks.length} subtask${task.subtasks.length > 1 ? 's' : ''}`}
                position='right'
                withArrow
                sx={(theme) => ({ backgroundColor: theme.colors.dark[8] })}
              >
                <Group spacing={1} align='center' sx={(theme) => ({
                  color: theme.colors.dark[2],
                  cursor: 'default'
                })}>
                  <Text size='sm'>{task.subtasks.length}</Text>
                  <Subtask size={15} style={{ marginTop: '2px' }} />
                </Group>
              </Tooltip>
            )}

            {task.dependencies && task.dependencies.length > 0 && (
              <Tooltip
                label={`${task.dependencies.length} dependenc${task.dependencies.length > 1 ? 'ies' : 'y'}`}
                position='right'
                withArrow
                sx={(theme) => ({ backgroundColor: theme.colors.dark[8] })}
              >
                <Group spacing={1} align='center' sx={(theme) => ({
                  color: theme.colors.dark[2],
                  cursor: 'default'
                })}>
                  <Text size='sm'>{task.dependencies.length}</Text>
                  <GitMerge size={15} style={{ marginTop: '2px' }} />
                </Group>
              </Tooltip>
            )}
          </Group>

          <Text size='sm' sx={(theme) => ({ marginBottom: '0.4rem', color: theme.colors.dark[0] })}>{task.summary}</Text>

          {tags && task.tags && task.tags.length > 0 && (
            <Group spacing={6} mb={task.assignee ? 0 : 5}>
              {task.tags.sort().map((id, i) => {
                const tag = tags[id];

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
          )}

          <Group spacing={5}>
            <TaskPriorityIcon priority={task.priority} />

            <Box sx={{ flexGrow: 1 }} />

            {task.assignee && (
              <MemberAvatar
                member={task.assignee}
                size={32}
              />
            )}
          </Group>
        </Stack>
      )}
    </Draggable>
  );
}


////////////////////////////////////////////////////////////
type KanbanViewProps = {
  board: BoardWrapper;
  tasks: TasksWrapper;
  domain: DomainWrapper;
}

////////////////////////////////////////////////////////////
export default function KanbanView({ board, ...props }: KanbanViewProps) {
  const [filterTags, setFilterTags] = useState<string[]>([]);

  // Status data
  const statuses = board.statuses;

  // Create tags map
  const tags = useMemo<Record<string, TaskTag & { value: string }>>(() => {
    if (!board?.tags) return {};

    // Add tags to map
    const map: Record<string, TaskTag & { value: string }> = {};
    for (const tag of board.tags)
      map[tag.id] = { ...tag, value: tag.id.toString() };

    return map;
  }, [board?.tags]);

  // Group tasks by status
  const [tasks, setTasks] = useMemoState<Record<string, ExpandedTask[]>>(
    () => {
      if (!board._exists) return;

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

      // Group data
      const data = groupBy(filtered, (task) => task.status);

      // Maintain order (prevents snapping when changing status)
      let exists = false;
      try { exists = tasks !== undefined; } catch(e) { }

      if (exists && tasks) {
        const reordered: Record<string, ExpandedTask[]> = {};

        // Make list of existing tasks
        const existing = new Set<number>(filtered.map(task => task.sid));

        // Iterate (new) status groups
        for (const [status, newTasks] of Object.entries(data)) {
          const group: ExpandedTask[] = [];
          const added = new Set<number>();

          // Iterate (old) status group and add tasks in order they appear, while keeping track of which tasks are added
          for (const task of tasks[status]) {
            if (existing.has(task.sid)) {
              group.push(task);
              added.add(task.sid);
            }
          }

          // Iterate (new) status group and add all tasks that haven't been added
          for (const task of newTasks) {
            if (!added.has(task.sid))
              group.push(task);
          }

          // Set status group
          reordered[status] = group;
        }

        return reordered;
      }

      return data;
    },
    [props.tasks.data, filterTags]
  );


  ////////////////////////////////////////////////////////////
  function onTaskMove(task: ExpandedTask, src_index: number, status: string, index: number) {
    if (!board._exists || !tasks) return;

    // Remove task from original position
    const srcCopy = [...tasks[task.status]];
    srcCopy.splice(src_index, 1);
    
    // Take different actions based on if the task went through status change
    if (task.status === status) {
      // Status didn't change, just reordered
      srcCopy.splice(index, 0, task);
      
      // Update tasks
      setTasks({ ...tasks, [status]: srcCopy });
    }
    else {
      // Add new task to other list
      const dstCopy = [...(tasks[status] || [])];
      dstCopy.splice(index, 0, { ...task, status });
      console.log(`${task.status} -> ${status}`, dstCopy.map(x => x.id));

      // Update tasks
      setTasks({ ...tasks, [task.status]: srcCopy, [status]: dstCopy });

      // Send update to database
      props.tasks._mutators.updateTask(task.id, { status });
    }
  }


  return (
    <Stack spacing={32} sx={(theme) => ({
      width: '100%',
      height: '100%',
      padding: '1.0rem 1.5rem 1.0rem 1.5rem'
    })}>
      <Group align='end'>
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

      {statuses && (
        <DragDropContext onDragEnd={(result) => {
          const { source: src, destination: dst } = result;

          if (tasks && dst) {
            onTaskMove(tasks[src.droppableId][src.index], src.index, dst.droppableId, dst.index);
          }
        }}>
          <SimpleGrid
            cols={statuses.length}
            sx={{
              width: `${statuses.length * 41}ch`,
            }}
          >
            {statuses?.map((status, i) => (
              <Flex direction='column'>
                <Flex gap='xs' align='center' sx={(theme) => ({
                  padding: '0.4rem 0.5rem 0.4rem 0.8rem',
                  backgroundColor: theme.colors.dark[4],
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                })}>
                  <ColorSwatch size={18} color={status.color} />
                  <Title order={5} sx={{ flexGrow: 1 }}>
                    {status.label} - {tasks && tasks[status.label] ? tasks[status.label].length : 0}
                  </Title>

                  <ActionIcon
                    onClick={() => {
                      if (board._exists) {
                        openCreateTask({
                          board_id: board.id,
                          domain: props.domain,
                          status: status.label,
                        });
                      }
                    }}
                  >
                    <Plus size={19} />
                  </ActionIcon>
                </Flex>

                <Droppable droppableId={status.label}>
                  {(provided) => (
                    <Box
                      ref={provided.innerRef}
                      sx={(theme) => ({
                        flexGrow: 1,
                        padding: '9px 9px 0.1px 9px',
                        backgroundColor: theme.colors.dark[8],
                        borderBottomLeftRadius: 6,
                        borderBottomRightRadius: 6,
                      })}
                      {...provided.droppableProps}
                    >
                      {tasks && tasks[status.label]?.map((task, j) => (
                        <TaskCard
                          task={task}
                          prefix={board?.prefix || ''}
                          tags={tags}

                          key={task.id}
                          index={j}
                          onClick={() => {
                            if (board._exists)
                              openEditTask({
                                board_id: board.id,
                                board_prefix: board.prefix,
                                domain: props.domain,
                                task: task,
                              });
                          }}
                        />
                      ))}

                      {provided.placeholder}
                    </Box>
                  )}
                </Droppable>
              </Flex>
            ))}
          </SimpleGrid>
        </DragDropContext>
      )}
    </Stack>
  )
}
