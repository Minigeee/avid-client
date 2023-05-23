import {} from 'react';

import {
  Box,
  Divider,
  Flex,
  ScrollArea,
  ScrollAreaProps,
  Stack,
  Text,
  UnstyledButton
} from '@mantine/core';


////////////////////////////////////////////////////////////
type SettingsTabProps = {
  value: string;
  label: string;
  selected: boolean;
  onClick: () => void;
};

////////////////////////////////////////////////////////////
function SettingsTab(props: SettingsTabProps) {
  return (
    <Flex wrap='nowrap'>
      <Box sx={(theme) => ({
        width: props.selected ? 4 : 0,
        background: theme.fn.linearGradient(50, theme.colors.violet[5], theme.colors.pink[5]),
        borderTopLeftRadius: 4,
        borderBottomLeftRadius: 4,
      })} />
      <UnstyledButton
        data-selected={props.selected || undefined}
        sx={(theme) => ({
          display: 'block',
          width: '100%',
          padding: '0.3rem 0.3rem 0.3rem 0.65rem',
          color: theme.colors.dark[1],
          borderRadius: theme.radius.sm,
          transition: 'background-color 0.1s',
          '&:hover': {
            backgroundColor: theme.colors.dark[5],
          },
          '&[data-selected]': {
            paddingLeft: 'calc(0.65rem - 4px)',
            backgroundColor: theme.colors.dark[5],
            color: theme.colors.dark[0],
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
          },
        })}
        onClick={props.onClick}
      >
        <Text size='md' weight={600}>{props.label}</Text>
      </UnstyledButton>
    </Flex>
  );
}


////////////////////////////////////////////////////////////
type SettingsMenuProps = {
  values: Record<string, { value: string; label: string }[]>;
  value: string;
  onChange: (value: string, label: string) => void;

  scrollAreaProps?: ScrollAreaProps;
};

////////////////////////////////////////////////////////////
export default function SettingsMenu(props: SettingsMenuProps) {
  return (
    <ScrollArea h='100%' {...props.scrollAreaProps}>
      <Stack spacing={2} p={4} pt={8} pl={6}>
        {Object.entries(props.values).map(([group, values]) => (
          <>
            <Text size='sm' weight={700} color='dimmed' ml={6} mb={2}>
              {group}
            </Text>
            {values.map((tab, i) => (
              <SettingsTab
                key={tab.value}
                {...tab}
                selected={props.value === tab.value}
                onClick={() => props.onChange(tab.value, tab.label)}
              />
            ))}

            {/* <Divider mt={6} mr={8} ml={8} /> */}
          </>
        ))}
      </Stack>
    </ScrollArea>
  )
}
