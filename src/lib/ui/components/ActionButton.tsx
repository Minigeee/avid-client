import {
  ActionIcon,
  ActionIconProps,
  Tooltip,
} from '@mantine/core';


export type ActionButtonProps = ActionIconProps & {
  tooltip?: string;
  onClick?: () => unknown,
};


export default function ActionButton(props: ActionButtonProps) {
  return (
    <Tooltip
      label={props.tooltip}
      withArrow
      sx={(theme) => ({ backgroundColor: theme.colors.dark[9] })}
    >
      <ActionIcon {...props} sx={(theme) => ({
        '&:hover': {
          backgroundColor: theme.colors.dark[4],
        }
      })}>{props.children}</ActionIcon>
    </Tooltip>
  );
}