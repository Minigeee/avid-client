import { memo, useEffect, useMemo, useState } from 'react';
import assert from 'assert';

import {
  Accordion,
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
  IconChevronDown,
  IconGitMerge,
  IconPlus,
  IconSearch,
  IconSubtask,
  IconTag,
} from '@tabler/icons-react';

import { ContextMenu } from '@/lib/ui/components/ContextMenu';
import MemberAvatar from '@/lib/ui/components/MemberAvatar';
import TaskPriorityIcon from '@/lib/ui/components/TaskPriorityIcon';
import TaskTagsSelector from '@/lib/ui/components/TaskTagsSelector';
import TaskGroupAccordion from '@/lib/ui/components/TaskGroupAccordion';
import { openCreateTask, openEditTask } from '@/lib/ui/modals';
import { CreateTaskProps } from '@/lib/ui/modals/CreateTask';

import { TaskContextMenu, TaskMenuContext } from './components/TaskMenu';
import { DoubleGrouped, GroupableFields, SingleGrouped } from './BoardView';

import config from '@/config';
import {
  BoardWrapper,
  DomainWrapper,
  TasksWrapper,
  getMemberSync,
  hasPermission,
  useMemoState,
  useSession,
} from '@/lib/hooks';
import { ExpandedTask, Label, TaskPriority } from '@/lib/types';

import { groupBy, round } from 'lodash';
import moment from 'moment';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';


////////////////////////////////////////////////////////////
type TaskCardProps = {
  task: ExpandedTask;
  prefix: string;
  editable?: boolean;

  tags: Record<string, Label>;

  index: number;
  onClick: () => unknown,
}

////////////////////////////////////////////////////////////
function TaskCard({ task, prefix, tags, ...props }: TaskCardProps) {
  return (
    <ContextMenu.Trigger context={{ task } as TaskMenuContext} disabled={props.editable === false}>
      <Draggable draggableId={task.id.toString()} index={props.index}>
        {(provided) => (
          <Stack
            ref={provided.innerRef}
            spacing={6}
            mb={9}
            sx={(theme) => ({
              padding: '0.7rem 0.8rem',
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
                    <IconSubtask size={15} style={{ marginTop: '2px' }} />
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
                    <IconGitMerge size={15} style={{ marginTop: '2px' }} />
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
                    <Box key={id} sx={{
                      padding: '1px 11px 2px 11px',
                      backgroundColor: tag.color || 'gray',
                      borderRadius: 15,
                      cursor: 'default',
                    }}>
                      <Text size='xs' weight={500}>{tag.label}</Text>
                    </Box>
                  );
                })}
              </Group>
            )}

            <Group spacing={6}>
              <TaskPriorityIcon priority={task.priority} />
              {task.due_date && (
                <Tooltip
                  label={moment(task.due_date).format('ll')}
                  position='right'
                  withArrow
                  sx={(theme) => ({ backgroundColor: theme.colors.dark[8] })}
                >
                  <Text size='xs' sx={(theme) => ({
                    padding: '1px 8px',
                    backgroundColor: theme.colors.dark[4],
                    borderRadius: 15,
                    cursor: 'default',
                  })}>
                    {moment(task.due_date).calendar({
                      sameDay: '[Today]',
                      nextDay: '[Tomorrow]',
                      nextWeek: 'dddd',
                      lastDay: '[Yesterday]',
                      lastWeek: 'l',
                      sameElse: 'l'
                    })}
                  </Text>
                </Tooltip>
              )}

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
    </ContextMenu.Trigger>
  );
}

const MemoTaskCard = memo(TaskCard);


////////////////////////////////////////////////////////////
type KanbanProps = {
  board: BoardWrapper;
  domain: DomainWrapper;
  collection: string;
  tasks: SingleGrouped;
  grouper: GroupableFields | null;
  group: string | null;

  tagMap: Record<string, Label>;

  /** Indicates if tasks can be created using kanban UI */
  creatable?: boolean;
};

////////////////////////////////////////////////////////////
function Kanban({ board, tasks, group, ...props }: KanbanProps) {
  const session = useSession();
  const canManageAny = hasPermission(props.domain, board.id, 'can_manage_tasks');

  return (
    <SimpleGrid
      cols={Object.keys(board.statuses).length}
      sx={{
        width: `${Object.keys(board.statuses).length * 41}ch`,
      }}
    >
      {Object.values(board.statuses).map((status, i) => (
        <Flex key={status.id} direction='column'>
          <Flex gap='xs' align='center' sx={(theme) => ({
            padding: '0.4rem 0.5rem 0.4rem 0.8rem',
            backgroundColor: theme.colors.dark[4],
            borderTopLeftRadius: 6,
            borderTopRightRadius: 6,
          })}>
            {status.color && <ColorSwatch size={18} color={status.color} />}
            <Title order={5} sx={{ flexGrow: 1 }}>
              {status.label} - {tasks && tasks[status.id] ? tasks[status.id].length : 0}
            </Title>

            {props.creatable !== false && (
              <ActionIcon
                onClick={() => {
                  // Add starting group data
                  const groupData: Partial<CreateTaskProps> = {};

                  if (group) {
                    if (props.grouper === 'assignee')
                      groupData.assignee = group === '_' ? undefined : getMemberSync(props.domain.id, group) || undefined;
                    else if (props.grouper === 'tags')
                      groupData.tag = group === '_' ? undefined : group;
                    else if (props.grouper === 'priority')
                      groupData.priority = group === '_' ? undefined : group as TaskPriority;
                    else if (props.grouper === 'due_date')
                      groupData.due_date = group === '_' ? undefined : group;
                  }

                  openCreateTask({
                    board_id: board.id,
                    domain: props.domain,
                    status: status.id,
                    collection: props.collection,
                    ...groupData,
                  });
                }}
              >
                <IconPlus size={19} />
              </ActionIcon>
            )}
          </Flex>

          <Droppable droppableId={`${group || null}.${status.id}`}>
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
                {tasks && tasks[status.id]?.map((task, j) => (
                  <MemoTaskCard
                    task={task}
                    prefix={board?.prefix || ''}
                    tags={props.tagMap}
                    editable={canManageAny || task.assignee?.id === session.profile_id}

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
  );
}


////////////////////////////////////////////////////////////
type KanbanViewProps = {
  board: BoardWrapper;
  tasks: TasksWrapper;
  domain: DomainWrapper;
  collection: string;

  filtered: SingleGrouped | DoubleGrouped;
  setFiltered: (filtered: SingleGrouped | DoubleGrouped) => any;
  grouper: GroupableFields | null;
}

////////////////////////////////////////////////////////////
export default function KanbanView({ board, filtered, grouper, ...props }: KanbanViewProps) {
  // Used to track which accordion panels are expanded
  const [expanded, setExpanded] = useState<Record<string, string[]>>({});
  // Memo this so it doesn't change every render
  const groups = useMemo<string[]>(() => Object.keys(filtered), [filtered]);

  
  // Determine if user can create tasks
  const creatable = hasPermission(props.domain, board.id, 'can_manage_tasks') || hasPermission(props.domain, board.id, 'can_manage_own_tasks');

  // Tag map
  const tagMap = useMemo<Record<string, Label>>(() => {
    const map: Record<string, Label> = {};
    for (const tag of board.tags)
      map[tag.id] = tag;
    return map;
  }, [board.tags]);


  return (
    <DragDropContext onDragEnd={(result) => {
      const { source: src, destination: dst } = result;

      // Get task and the source/destination lists
      let task: ExpandedTask;
      let srcParts: string[];
      let srcList: ExpandedTask[];

      if (grouper) {
        srcParts = src.droppableId.split('.');
        srcList = (filtered as DoubleGrouped)[srcParts[0]][srcParts[1]].slice();
        task = srcList[src.index];
      }
      else {
        srcParts = src.droppableId.split('.');
        srcList = (filtered as SingleGrouped)[srcParts[1]].slice();
        task = srcList[src.index];
      }
      
      // Get destination list
      let dstParts: string[];
      let dstList: ExpandedTask[];

      if (!dst) {
        // Handle destroy task
        return;
      }
      else if (src.droppableId === dst.droppableId) {
        dstParts = srcParts;
        dstList = srcList;
      }
      else if (grouper) {
        dstParts = dst.droppableId.split('.');
        dstList = (filtered as DoubleGrouped)[dstParts[0]][dstParts[1]]?.slice() || [];
      }
      else {
        dstParts = dst.droppableId.split('.');
        dstList = (filtered as SingleGrouped)[dstParts[1]]?.slice() || [];
      }

      // Remove task from original position
      srcList.splice(src.index, 1);

      // Add task to new position
      dstList.splice(dst.index, 0, task);

      // Apply lists
      if (grouper) {
        props.setFiltered({
          ...filtered,
          [srcParts[0]]: { [srcParts[1]]: srcList },
          [dstParts[0]]: { [dstParts[1]]: dstList },
        } as DoubleGrouped);
      }
      else {
        props.setFiltered({
          ...filtered,
          [srcParts[1]]: srcList,
          [dstParts[1]]: dstList,
        } as SingleGrouped);
      }

      // Handle task mutation if changed lists
      if (src.droppableId !== dst.droppableId) {
        const updates: Partial<ExpandedTask> = {};

        // Status change
        if (srcParts[1] !== dstParts[1])
          updates.status = dstParts[1];

        // Group change
        if (srcParts[0] !== dstParts[0]) {
          if (grouper === 'assignee')
            updates.assignee = dstParts[0] === '_' ? null : getMemberSync(props.domain.id, dstParts[0]);

          else if (grouper === 'due_date')
            updates.due_date = dstParts[0] === '_' ? null : dstParts[0];

          else if (grouper === 'priority')
            updates.priority = dstParts[0] === '_' ? null : dstParts[0] as TaskPriority;

          // Tag changes are not allowed
        }

        // Apply changes
        props.tasks._mutators.updateTask(task.id, updates);
      }
    }}>
      <TaskContextMenu
        board={board}
        tasks={props.tasks}
        domain={props.domain}
        collection={props.collection}
      >
        {grouper && (
          <TaskGroupAccordion
            domain={props.domain}
            groups={groups}
            expanded={expanded}
            setExpanded={setExpanded}

            component={(group) => (
              <Kanban
                board={board}
                domain={props.domain}
                collection={props.collection}
                tasks={(filtered as DoubleGrouped)[group]}
                grouper={grouper}
                group={group}

                tagMap={tagMap}
                creatable={creatable}
              />
            )}

            tagMap={tagMap}
            collection={props.collection}
            grouper={grouper}
          />
        )}
        {!grouper && (
          <Kanban
            board={board}
            domain={props.domain}
            collection={props.collection}
            tasks={filtered as SingleGrouped}
            grouper={grouper}
            group={null}

            tagMap={tagMap}
            creatable={creatable}
          />
        )}
      </TaskContextMenu>
    </DragDropContext>
  );
}
