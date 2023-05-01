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


////////////////////////////////////////////////////////////
type TaskPriorityIconProps = {
  priority: number | null | undefined;
  outerSize?: number;
  innerSize?: number;

  tooltip?: boolean;
  sx?: Sx;
}

////////////////////////////////////////////////////////////
export default function TaskPriorityIcon(props: TaskPriorityIconProps) {
  const theme = useMantineTheme();

  const priorities = [
    { label: 'Critical', color: theme.colors.red[5], icon: ChevronsUp },
    { label: 'High', color: theme.colors.orange[5], icon: ChevronUp },
    { label: 'Medium', color: theme.colors.yellow[4], icon: Equal },
    { label: 'Low', color: theme.colors.blue[4], icon: ChevronDown },
    { label: 'None', color: theme.colors.gray[5], icon: Point },
  ];
  const priority = priorities[props.priority !== undefined && props.priority !== null ? props.priority : 4];


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
        position='left'
        withArrow
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
