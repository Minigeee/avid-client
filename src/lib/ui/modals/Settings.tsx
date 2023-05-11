import { PropsWithChildren, useState } from 'react';

import {
  Box,
  Center,
  CloseButton,
  Flex,
  Group,
  ScrollArea,
  Stack,
  Text,
  Title,
  UnstyledButton
} from '@mantine/core';

import { useApp, useMemoState } from '@/lib/hooks';


////////////////////////////////////////////////////////////
type SettingsProps = PropsWithChildren & {
  values: Record<string, { value: string; label: string }[]>;
  value: string;
  onChange: (value: string) => void;
};

////////////////////////////////////////////////////////////
type SettingsTabProps = {
  value: string;
  label: string;
};

////////////////////////////////////////////////////////////
export default function Settings({ onChange, ...props }: SettingsProps) {
  const app = useApp();

  const tab = props.value;
  const [label, setLabel] = useMemoState<string>(() => {
    if (!props.value)
      return '';

    for (const tabs of Object.values(props.values)) {
      const tab = tabs.find(x => x.value === props.value);
      if (tab)
        return tab.label;
    }

    return '';
  }, []);


  ////////////////////////////////////////////////////////////
  function SettingsTab(props: SettingsTabProps) {
    const selected = tab === props.value;

    return (
      <Flex wrap='nowrap'>
        <Box sx={(theme) => ({
          width: selected ? 4 : 0,
          background: theme.fn.linearGradient(50, theme.colors.violet[5], theme.colors.pink[5]),
          borderTopLeftRadius: 4,
          borderBottomLeftRadius: 4,
        })} />
        <UnstyledButton
          data-selected={selected || undefined}
          sx={(theme) => ({
            display: 'block',
            width: '100%',
            padding: '0.3rem 0.3rem 0.3rem 0.65rem',
            color: theme.colors.dark[1],
            borderRadius: theme.radius.sm,
            transition: 'background-color 0.1s',
            '&:hover': {
              backgroundColor: theme.colors.dark[4],
            },
            '&[data-selected]': {
              paddingLeft: 'calc(0.65rem - 4px)',
              backgroundColor: theme.colors.dark[4],
              color: theme.colors.dark[0],
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
            },
          })}
          onClick={() => {
            onChange(props.value);
            setLabel(props.label);
          }}
        >
          <Text size='md' weight={600}>{props.label}</Text>
        </UnstyledButton>
      </Flex>
    );
  }

  return (
    <Center w='100vw' h='100vh' sx={(theme) => ({
      position: 'absolute',
      top: 0,
      backgroundColor: theme.colors.dark[8],
    })}>
      <Flex w='160ch' h='100vh' sx={{ maxWidth: '100%', boxShadow: '0px 0px 24px #00000010' }}>
        <ScrollArea w='30ch' h='100%' sx={(theme) => ({
          flexShrink: 0,
          backgroundColor: theme.colors.dark[6],
        })}>
          <Stack spacing={2} p={4} pt={12} pl={6}>
            {Object.entries(props.values).map(([group, values]) => (
              <>
                <Text size='sm' weight={700} color='dimmed' ml={8} mb={4}>
                  {group}
                </Text>
                {values.map((tab, i) => (
                  <SettingsTab {...tab} />
                ))}
              </>
            ))}
          </Stack>
        </ScrollArea>
        <ScrollArea h='100%' sx={(theme) => ({
          flexGrow: 1,
          padding: '1.5rem 1.5rem',
          backgroundColor: theme.colors.dark[7],
        })}>
          <Flex align='end' mb={24}>
            <Title order={3}>{label}</Title>
            <div style={{ flexGrow: 1 }} />
            <CloseButton
              size='lg'
              iconSize={24}
              onClick={() => app._mutators.navigation.setScreen('main')}
            />
          </Flex>
          {props.children}
        </ScrollArea>
      </Flex>
    </Center>
  );
}
