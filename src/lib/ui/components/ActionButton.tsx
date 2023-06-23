import { MouseEvent } from 'react';

import {
  ActionIcon,
  ActionIconProps,
  Tooltip,
  TooltipProps,
} from '@mantine/core';


export type ActionButtonProps = ActionIconProps & {
  tooltip?: string;
  tooltipProps?: Omit<TooltipProps, 'label' | 'children'>;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void,
};


export default function ActionButton(props: ActionButtonProps) {
  return (
    <Tooltip
      label={props.tooltip}
      withArrow
      sx={(theme) => ({ backgroundColor: theme.colors.dark[9] })}
      {...props.tooltipProps}
    >
      <ActionIcon {...props} sx={(theme) => {
        // Get passed in sx
        let sx = {};
        if (props.sx) {
          if (typeof props.sx === 'function')
            sx = props.sx(theme);
          else
            sx = props.sx;
        }

        return {
          '&:hover': {
            backgroundColor: theme.colors.dark[4],
          },
          ...sx
        };
      }}>{props.children}</ActionIcon>
    </Tooltip>
  );
}