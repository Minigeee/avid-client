import { forwardRef, useMemo, useState } from 'react';

import {
  Box,
  Button,
  Center,
  ColorSwatch,
  Divider,
  Flex,
  Group,
  ScrollArea,
  Select,
  SelectProps,
  Stack,
  Text,
  UnstyledButton,
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
import SearchBar from '@/lib/ui/components/SearchBar';
import { useDebouncedValue } from '@mantine/hooks';



////////////////////////////////////////////////////////////
interface TaskSelectItemProps extends React.ComponentPropsWithoutRef<'div'> {
  value: string;
  label: string;
  summary: string;
  assignee: ExpandedMember | null | undefined;
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
  task: Partial<Pick<ExpandedTask, 'id' | 'subtasks' | 'dependencies' | 'collection'>>;

  /** Determines if task should automatically be updated on task select (default true) */
  shouldUpdate?: boolean;
  /** Determines if the user is allowed to create new task (default true) */
  canCreateTask?: boolean;
  onSelect?: (id: string) => void;
  buttonComponent?: any;
};

////////////////////////////////////////////////////////////
export function TaskSelector(props: TaskSelectorProps) {
  // Task searcher
  const [search, setSearch] = useState<string>('');
  // Debounced search value
  const [debouncedSearch] = useDebouncedValue(search, 200, { leading: true });

  // Available tasks
  const options = useMemo(() => {
    // Status map
    const statusMap: Record<string, Label> = {};
    for (const status of props.board.statuses)
      statusMap[status.id] = status;

    // Set to exclude
    const exclude = new Set<string>((props.task[props.type === 'subtask' ? 'subtasks' : 'dependencies'] || []));
    if (props.task.id)
      exclude.add(props.task.id);

    return props.tasks.data.filter(x => !exclude.has(x.id)).sort((a, b) => b.sid - a.sid).map((task) => ({
      value: task.id,
      label: `${props.board.prefix}-${task.sid}`,
      sid: task.sid,
      summary: task.summary,
      assignee: task.assignee,
      status: statusMap[task.status],
    }));
  }, [props.tasks.data, props.board.prefix, props.task.subtasks, props.task.dependencies]);

  // Filtered tasks
  const filtered = useMemo(() => {
    let list: typeof options = [];
    if (!debouncedSearch?.length)
      list = options;

    else {
      const terms = debouncedSearch.toLocaleLowerCase().split(/\s+/);
      list = options.filter(x => {
        // Search filter
        if (debouncedSearch && !x.sid.toString().includes(debouncedSearch)) {
          const lcSummary = x.summary.toLocaleLowerCase();

          for (const term of terms) {
            if (term.length > 0 && !lcSummary.includes(term))
              return false;
          }
        }

        return true;
      })
    }

    return list.map((task) => (
      <UnstyledButton
        sx={(theme) => ({
          padding: '0.375rem 0.75rem',
          borderRadius: theme.radius.sm,

          '&:hover': {
            background: `linear-gradient(to right, ${theme.colors.dark[3]} 4px, ${theme.colors.dark[5]} 0)`,
          },
        })}

        onClick={() => {
          const id = task.value;
          
          // Perform update
          if (props.shouldUpdate !== false && props.task.id) {
            const update = props.type === 'subtask' ? { subtasks: (props.task.subtasks || []).concat([id]) } : { dependencies: (props.task.dependencies || []).concat([id]) };
            props.tasks._mutators.updateTask(props.task.id, update, true);
          }

          props.onSelect?.(id);
        }}
      >
        <TaskSelectItem {...task} />
      </UnstyledButton>
    ));
  }, [options, debouncedSearch]);


  return (
    <Stack spacing={0}>
      <SearchBar
        value={search}
        onChange={setSearch}
      />
      {options.length === 0 && (
        <Center w={config.app.ui.short_input_width} h='5rem'>
          <Text size='sm' color='dimmed'>There are no tasks</Text>
        </Center>
      )}
      <ScrollArea.Autosize w={config.app.ui.short_input_width} mah='15rem'>
        <Stack spacing={0} mt={4}>
          {filtered}
        </Stack>
      </ScrollArea.Autosize>

      {props.canCreateTask !== false && (
        <>
          <Divider label='or' labelPosition='center' labelProps={{ color: 'dimmed' }} sx={{ margin: '0.5rem 0.0rem' }} />

          <Button
            component={props.buttonComponent}
            variant='gradient'
            leftIcon={<IconPlus size={16} />}
            onClick={() => openCreateTask({
              board_id: props.board.id,
              domain: props.domain,
              type: props.type,
              extra_task: props.task.id,
              collection: props.task.collection || undefined,
            })}
          >
            Create Task
          </Button>
        </>
      )}
    </Stack>
  );
}