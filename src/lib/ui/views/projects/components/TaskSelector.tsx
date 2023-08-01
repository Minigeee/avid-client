import { forwardRef, useMemo } from 'react';

import {
  Box,
  Button,
  ColorSwatch,
  Divider,
  Flex,
  Group,
  Select,
  SelectProps,
  Stack,
  Text,
} from '@mantine/core';

import {
  IconPlus,
  IconSearch,
} from '@tabler/icons-react';

import { openCreateTask } from '@/lib/ui/modals';
import MemberAvatar from '@/lib/ui/components/MemberAvatar';

import config from '@/config';
import {
  BoardWrapper,
  DomainWrapper,
  TasksWrapper,
} from '@/lib/hooks';
import {
  ExpandedMember,
  ExpandedTask,
  Label,
} from '@/lib/types';



////////////////////////////////////////////////////////////
interface TaskSelectItemProps extends React.ComponentPropsWithoutRef<'div'> {
  value: string;
  label: string;
  summary: string;
  assignee: ExpandedMember | null;
  status: Label;
}

////////////////////////////////////////////////////////////
const TaskSelectItem = forwardRef<HTMLDivElement, TaskSelectItemProps>(
  ({ value, label, ...others }: TaskSelectItemProps, ref) => (
    <div ref={ref} {...others}>
      <Flex gap='sm' wrap='nowrap'>
        <Box sx={{ flexGrow: 1 }}>
          <Group spacing={8}>
            <ColorSwatch size={16} color={others.status.color || ''} />
            <Text size='sm' weight={600}>{label}</Text>
          </Group>
          <Text size='xs' color='dimmed'>{others.summary}</Text>
        </Box>

        {others.assignee && (
          <MemberAvatar
            member={others.assignee}
            size={32}
          />
        )}
      </Flex>
    </div>
  )
);
TaskSelectItem.displayName = 'TaskSelectItem';

////////////////////////////////////////////////////////////
type TaskSelectProps = Omit<SelectProps, 'data'> & {
  board: BoardWrapper;
  tasks: TasksWrapper;
  exclude_ids?: string[];
};

////////////////////////////////////////////////////////////
export function TaskSelect(props: TaskSelectProps) {
  // Available tasks
  const options = useMemo(() => {
    // Status map
    const statusMap: Record<string, Label> = {};
    for (const status of props.board.statuses)
      statusMap[status.id] = status;

    // Set to exclude
    const exclude = new Set<string>(props.exclude_ids);

    return props.tasks.data.filter(x => !exclude.has(x.id)).sort((a, b) => b.sid - a.sid).map((task) => ({
      value: task.id,
      label: `${props.board.prefix}-${task.sid}`,
      summary: task.summary,
      assignee: task.assignee,
      status: statusMap[task.status],
    }));
  }, [props.tasks.data, props.board.prefix, props.exclude_ids]);


  return (
    <Select
      searchable
      {...props}
      data={options}
      itemComponent={TaskSelectItem}
    />
  );
}



////////////////////////////////////////////////////////////
type TaskSelectorProps = {
  type: 'subtask' | 'dependency',
  domain: DomainWrapper;
  board: BoardWrapper;
  tasks: TasksWrapper;
  task: ExpandedTask;

  onSelect?: (id: string) => void;
  buttonComponent?: any;
};

////////////////////////////////////////////////////////////
export function TaskSelector(props: TaskSelectorProps) {
  // Available tasks
  const options = useMemo(() => {
    // Status map
    const statusMap: Record<string, Label> = {};
    for (const status of props.board.statuses)
      statusMap[status.id] = status;

    // Set to exclude
    const exclude = new Set<string>(props.task.subtasks?.concat([props.task.id]));

    return props.tasks.data.filter(x => !exclude.has(x.id)).sort((a, b) => b.sid - a.sid).map((task) => ({
      value: task.id,
      label: `${props.board.prefix}-${task.sid}`,
      summary: task.summary,
      assignee: task.assignee,
      status: statusMap[task.status],
    }));
  }, [props.tasks.data, props.board.prefix, props.task.subtasks]);


  return (
    <Stack spacing='sm'>
      <Select
          data={options}
          icon={<IconSearch size={16} />}
          placeholder='Select a task'
          searchable
          itemComponent={TaskSelectItem}
          withinPortal
          sx={{ minWidth: config.app.ui.short_input_width }}
          onChange={(id) => {
            if (!id) return;

            // Perform update
            const update = props.type === 'subtask' ? { subtasks: props.task.subtasks?.concat([id]) } : { dependencies: props.task.dependencies?.concat([id]) };
            props.tasks._mutators.updateTask(props.task.id, update, true);

            props.onSelect?.(id);
          }}
        />

        <Divider label='or' labelPosition='center' labelProps={{ color: 'dimmed' }} />

        <Button
          component={props.buttonComponent}
          variant='gradient'
          leftIcon={<IconPlus size={16} />}
          onClick={() => openCreateTask({
            board_id: props.board.id,
            domain: props.domain,
            type: props.type,
            extra_task: props.task.id,
          })}
        >
          Create Task
        </Button>
    </Stack>
  );
}