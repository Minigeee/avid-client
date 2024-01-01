import { Sx, ThemeIcon, Tooltip, useMantineTheme } from '@mantine/core';

import {
  IconChevronDown,
  IconChevronUp,
  IconChevronsUp,
  IconEqual,
  IconPoint,
} from '@tabler/icons-react';

import { TaskPriority } from '@/lib/types';
import { useMemo } from 'react';

////////////////////////////////////////////////////////////
type TaskPriorityIconProps = {
  priority: TaskPriority | null | undefined;
  outerSize?: number;
  innerSize?: number;

  tooltip?: boolean;
  tooltipPos?: 'left' | 'right';
  sx?: Sx;
};

////////////////////////////////////////////////////////////
export default function TaskPriorityIcon(props: TaskPriorityIconProps) {
  const theme = useMantineTheme();

  const priority = useMemo(() => {
    const id = props.priority || 'none';
    const size = props.innerSize || 18;

    if (id === 'critical')
      return {
        label: 'Critical',
        color: theme.colors.red[4],
        icon: <IconChevronsUp size={size} />,
      };
    else if (id === 'high')
      return {
        label: 'High',
        color: theme.colors.orange[5],
        icon: <IconChevronUp size={size} />,
      };
    else if (id === 'medium')
      return {
        label: 'Medium',
        color: theme.colors.yellow[4],
        icon: <IconEqual size={size} />,
      };
    else if (id === 'low')
      return {
        label: 'Low',
        color: theme.colors.blue[4],
        icon: <IconChevronDown size={size} />,
      };
    else
      return {
        label: 'None',
        color: theme.colors.gray[5],
        icon: <IconPoint size={size} />,
      };
  }, [props.innerSize, props.priority]);

  if (props.tooltip === false) {
    return (
      <ThemeIcon
        size={props.outerSize || 21}
        radius='xl'
        sx={(theme) => {
          // Get passed in sx
          let sx = {};
          if (props.sx) {
            if (typeof props.sx === 'function') sx = props.sx(theme);
            else sx = props.sx;
          }

          return {
            background: theme.other.colors.document,
            color: priority.color,
            ...sx,
          };
        }}
      >
        {priority.icon}
      </ThemeIcon>
    );
  } else {
    return (
      <Tooltip
        label={priority.label}
        position={props.tooltipPos || 'left'}
        withArrow
        withinPortal
      >
        <ThemeIcon
          size={props.outerSize || 21}
          radius='xl'
          sx={(theme) => ({
            background: theme.other.colors.document,
            color: priority.color,
            cursor: 'default',
          })}
        >
          {priority.icon}
        </ThemeIcon>
      </Tooltip>
    );
  }
}
