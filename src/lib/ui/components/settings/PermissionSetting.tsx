import { ReactNode } from 'react';
import { Box, Divider, Flex, Switch, SwitchProps, Text } from '@mantine/core';

import config from '@/config';

////////////////////////////////////////////////////////////
type PermissionSettingProps = {
  title: string;
  description: ReactNode;
  withDivider?: boolean;

  switchProps?: SwitchProps;
  disabled?: boolean;
  show?: boolean;
};

////////////////////////////////////////////////////////////
export default function PermissionSetting(props: PermissionSettingProps) {
  if (props.show === false) return null;
  return (
    <>
      <Flex maw={config.app.ui.settings_maw} wrap="nowrap" gap="1.0rem">
        <Box sx={{ flexGrow: 1 }}>
          <Text size="md" weight={600} mb={4}>
            {props.title}
          </Text>
          <Text size="sm" color="dimmed" maw="40rem">
            {props.description}
          </Text>
        </Box>

        <Switch {...props.switchProps} disabled={props.disabled} />
      </Flex>

      {props.withDivider !== false && (
        <Divider
          maw={config.app.ui.settings_maw}
          sx={(theme) => ({ borderColor: theme.colors.dark[5] })}
        />
      )}
    </>
  );
}
