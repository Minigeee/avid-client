import { useState } from 'react';

import {
  Box,
  Group,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  UnstyledButton,
} from '@mantine/core';

import MessagesView from '@/lib/ui/views/chat/MessagesView';
import MemberAvatar from '@/lib/ui/components/MemberAvatar';

import { DomainWrapper } from '@/lib/hooks';
import { Member } from '@/lib/types';


////////////////////////////////////////////////////////////
type SidePanelViewProps = {
  channel_id: string;
  domain: DomainWrapper;
  participants: Member[];
}

////////////////////////////////////////////////////////////
export default function SidePanelView(props: SidePanelViewProps) {
  const [tab, setTab] = useState<string | null>('chat');

  return (
    <Box sx={{
      display: 'flex',
      flexFlow: 'column',
      height: '100%',
    }}>
      <Group sx={(theme) => ({
        flexShrink: 0,
        height: '2.9rem',
        paddingTop: '0.2rem',
        paddingLeft: '0.3rem',
        borderBottom: `1px solid ${theme.colors.dark[6]}`
      })}>
        <Tabs
          value={tab}
          onTabChange={setTab}
          variant='pills'
          color='dark'
          styles={(theme) => ({
            tab: {
              color: theme.colors.dark[1],
              fontWeight: 600,
              transition: 'background-color 0.1s',

              '&:hover': {
                backgroundColor: theme.colors.dark[6],
              },
              '&[data-active]': {
                backgroundColor: theme.colors.dark[6],
                '&:hover': {
                  backgroundColor: theme.colors.dark[6],
                },
              },
            },
          })}
        >
          <Tabs.List>
            <Tabs.Tab value='chat'>Chat</Tabs.Tab>
            <Tabs.Tab value='participants'>Participants</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Group>

      <Box sx={{
        flexGrow: 1,
        height: 0,
        display: tab === 'chat' ? undefined : 'none',
      }}>
        <MessagesView
          channel_id={props.channel_id}
          domain={props.domain}
          p='1.25rem'
          pb='1.5rem'
        />
      </Box>
      
      <ScrollArea sx={{
        display: tab === 'participants' ? undefined : 'none',
      }}>
        <Stack spacing={0}>
          {props.participants.map((member, i) => (
            <UnstyledButton
              key={member.id}
              sx={(theme) => ({
                display: 'block',
                width: '100%',
                padding: '0.2rem 0.3rem 0.2rem 0.5rem',
                borderRadius: theme.radius.sm,
                transition: 'background-color 0.1s',
                '&:hover': {
                  backgroundColor: theme.colors.dark[6],
                },
              })}
            >
              <Group spacing='xs' align='center'>
                <MemberAvatar size={36} member={member} />
                <Text size='sm' weight={600}>{member.alias}</Text>
              </Group>
            </UnstyledButton>
          ))}
        </Stack>
      </ScrollArea>
    </Box>
  );
}
