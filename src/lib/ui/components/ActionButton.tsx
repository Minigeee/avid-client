import { MouseEvent } from 'react';

import {
  ActionIcon,
  ActionIconProps,
  MantineTheme,
  Tooltip,
  TooltipProps,
} from '@mantine/core';

export type ActionButtonProps = ActionIconProps & {
  tooltip?: string;
  tooltipProps?: Omit<TooltipProps, 'label' | 'children'>;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
};

export default function ActionButton({
  tooltip,
  tooltipProps,
  ...props
}: ActionButtonProps) {
  return (
    <Tooltip label={tooltip} withArrow {...tooltipProps}>
      <ActionIcon {...props}>{props.children}</ActionIcon>
    </Tooltip>
  );
}
