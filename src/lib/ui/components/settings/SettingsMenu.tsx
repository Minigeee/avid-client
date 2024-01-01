import {} from 'react';

import {
  Box,
  Button,
  Divider,
  Flex,
  ScrollArea,
  ScrollAreaProps,
  Space,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';

////////////////////////////////////////////////////////////
type SettingsTabProps = {
  value: string;
  label: string;
  link?: string;
  selected: boolean;
  onClick: () => void;
};

////////////////////////////////////////////////////////////
function SettingsTab(props: SettingsTabProps) {
  return (
    <Flex wrap='nowrap'>
      <Box
        sx={(theme) => ({
          width: props.selected ? 4 : 0,
          background: theme.fn.linearGradient(
            50,
            theme.colors.violet[5],
            theme.colors.pink[5],
          ),
          borderTopLeftRadius: 4,
          borderBottomLeftRadius: 4,
        })}
      />
      {/* @ts-ignore */}
      <UnstyledButton
        data-selected={props.selected || undefined}
        sx={(theme) => ({
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          padding: '0.3rem 0.65rem',
          color: theme.other.elements.settings_tabs_text,
          borderRadius: theme.radius.sm,
          transition: 'background 0.1s',
          '&:hover': {
            background: theme.other.elements.settings_tabs_hover,
          },
          '&[data-selected]': {
            paddingLeft: 'calc(0.65rem - 4px)',
            background: theme.other.elements.settings_tabs_hover,
            color: theme.other.elements.settings_tabs_text,
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
          },
          '.tabler-icon': {
            color: theme.other.elements.settings_tabs_dimmed,
          },
        })}
        onClick={props.link ? undefined : props.onClick}
        {...(props.link
          ? {
              component: 'a',
              href: props.link,
              target: '_blank',
              rel: 'noreferrer noopener',
            }
          : {})}
      >
        <Text size='md' weight={600}>
          {props.label}
        </Text>
        {props.link && (
          <>
            <div style={{ flexGrow: 1 }} />
            <IconExternalLink size={18} style={{ marginTop: -2 }} />
          </>
        )}
      </UnstyledButton>
    </Flex>
  );
}

////////////////////////////////////////////////////////////
type SettingsMenuProps = {
  values: Record<string, { value: string; label: string; link?: string }[]>;
  value: string;
  onChange: (value: string, label: string) => void;

  scrollAreaProps?: ScrollAreaProps;
  groupNames?: Record<string, string>;
};

////////////////////////////////////////////////////////////
export default function SettingsMenu(props: SettingsMenuProps) {
  return (
    <ScrollArea h='100%' {...props.scrollAreaProps}>
      <Stack spacing={0} p={4} pt={8} pl={6}>
        {Object.entries(props.values).map(([group, values]) => (
          <>
            <Text
              size='sm'
              weight={700}
              ml={6}
              mb={3}
              sx={(theme) => ({
                color: theme.other.elements.settings_tabs_dimmed,
              })}
            >
              {props.groupNames?.[group] || group}
            </Text>
            {values.map((tab, i) => (
              <SettingsTab
                key={tab.value}
                {...tab}
                selected={props.value === tab.value}
                onClick={() => props.onChange(tab.value, tab.label)}
              />
            ))}

            <Space h='sm' />
            {/* <Divider mt={6} mb={4} mr={6} ml={6} /> */}
          </>
        ))}
      </Stack>
    </ScrollArea>
  );
}
