import {
  Sx,
  ThemeIcon,
  Tooltip,
  useMantineTheme,
} from '@mantine/core';

import {
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  Equal,
  GitMerge,
  Icon,
  Point,
  Subtask,
} from 'tabler-icons-react';

import { TaskPriority } from '@/lib/types';


////////////////////////////////////////////////////////////
type TaskPriorityIconProps = {
  priority: TaskPriority | null | undefined;
  outerSize?: number;
  innerSize?: number;

  tooltip?: boolean;
  tooltipPos?: 'left' | 'right';
  sx?: Sx;
}

////////////////////////////////////////////////////////////
export default function TaskPriorityIcon(props: TaskPriorityIconProps) {
  const theme = useMantineTheme();

  const priorities = {
    critical: { label: 'Critical', color: theme.colors.red[5], icon: ChevronsUp },
    high: { label: 'High', color: theme.colors.orange[5], icon: ChevronUp },
    medium: { label: 'Medium', color: theme.colors.yellow[4], icon: Equal },
    low: { label: 'Low', color: theme.colors.blue[4], icon: ChevronDown },
    none: { label: 'None', color: theme.colors.gray[5], icon: Point },
  };
  const priority = priorities[props.priority || 'none'];


  if (props.tooltip === false) {
    return (
      <ThemeIcon size={props.outerSize || 21} radius='xl' sx={(theme) => {
        // Get passed in sx
        let sx = {};
        if (props.sx) {
          if (typeof props.sx === 'function')
            sx = props.sx(theme);
          else
            sx = props.sx;
        }

        return {
          backgroundColor: theme.colors.dark[4],
          color: priority.color,
          ...sx,
        };
      }}>
        {priority.icon({ size: props.innerSize || 18 })}
      </ThemeIcon>
    );
  }
  else {
    return (
      <Tooltip
        label={priority.label}
        position={props.tooltipPos || 'left'}
        withArrow
        withinPortal
        sx={(theme) => ({ backgroundColor: theme.colors.dark[8] })}
      >
        <ThemeIcon size={props.outerSize || 21} radius='xl' sx={(theme) => ({
          backgroundColor: theme.colors.dark[4],
          color: priority.color,
          cursor: 'default',
        })}>
          {priority.icon({ size: props.innerSize || 18 })}
        </ThemeIcon>
      </Tooltip>
    );
  }
}
