import { forwardRef, memo, useMemo, useState } from 'react';

import {
  Box,
  CloseButton,
  Divider,
  Group,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';

import MessagesView from '@/lib/ui/views/chat/MessagesView';
import MemberAvatar from '@/lib/ui/components/MemberAvatar';
import MemberPopover from '@/lib/ui/components/MemberPopover';

import { DomainWrapper, useMember, useSession } from '@/lib/hooks';
import { ExpandedMember, Member } from '@/lib/types';


////////////////////////////////////////////////////////////
type SidePanelViewProps = {
  channel_id: string;
  domain: DomainWrapper;
  participants: ExpandedMember[];
}

////////////////////////////////////////////////////////////
export default function SidePanelView(props: SidePanelViewProps) {
  const session = useSession();

  const self = useMember(props.domain.id, session.profile_id);

  const [tab, setTab] = useState<string | null>('chat');
  const [search, setSearch] = useState<string>('');

  // Filtered participants with self
  const participants = useMemo(() => {
    const lc = search.toLocaleLowerCase();
    const members = self._exists ? props.participants.concat([self]).sort((a, b) => a.alias.localeCompare(b.alias)) : props.participants;
    return members.filter(m => m.alias.toLocaleLowerCase().indexOf(lc) >= 0);
  }, [props.participants, self, search]);

  
  // Member item
  const MemberListItem = useMemo(() => {
    const component = memo(forwardRef<HTMLDivElement, { member: ExpandedMember }>(
      ({ member, ...others }, ref) => {
        let alias = member.alias.replace(/<[^>]*>/g, '');
        if (search.length > 0) {
          const idx = alias.toLocaleLowerCase().indexOf(search.toLocaleLowerCase());
          if (idx >= 0)
            alias = `${alias.slice(0, idx)}<b>${alias.slice(idx, idx + search.length)}</b>${alias.slice(idx + search.length)}`;
        }

        return (
          <MemberPopover domain={props.domain} member={member} popoverProps={{ position: 'left-start' }} withinPortal>
            <UnstyledButton
              sx={(theme) => ({
                padding: '0rem 0.5rem',
                borderRadius: theme.radius.sm,
                '&:hover': {
                  backgroundColor: theme.colors.dark[6],
                },
              })}
            >
              <Group ref={ref} {...others} spacing={6} noWrap sx={{
                height: '2.6rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
              <MemberAvatar size={32} member={member} />
                <Text
                  ml={6}
                  size='sm'
                  weight={search.length > 0 ? 400 : 600}
                  sx={(theme) => ({ color: theme.colors.gray[4] })}
                  dangerouslySetInnerHTML={{ __html: alias }}
                />
              </Group>
            </UnstyledButton>
          </MemberPopover>
        );
      }
    ));
    component.displayName = 'MemberListItem';

    return component;
  }, [search]);


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

      {tab === 'chat' && (
        <Box sx={{
          flexGrow: 1,
          height: 0,
        }}>
          <MessagesView
            channel_id={props.channel_id}
            domain={props.domain}
            p='1.2rem'
            pb='1.5rem'
            avatarGap='md'
            withSidePanel={false}
          />
        </Box>
      )}

      {tab === 'participants' && (
        <>
          <TextInput
            m={8}
            placeholder='Search participants'
            icon={<IconSearch size={18} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            rightSection={search.length > 0 ? (
              <CloseButton
                onClick={() => setSearch('')}
              />
            ) : undefined}
          />

          <Divider sx={(theme) => ({ color: theme.colors.dark[5], borderColor: theme.colors.dark[5] })} />

          <ScrollArea p={8} sx={{ flexGrow: 1 }}>
            <Stack spacing={0}>
              {participants.map((member, i) => (
                <MemberListItem
                  key={member.id}
                  member={member}
                />
              ))}
            </Stack>
          </ScrollArea>
        </>
      )}
    </Box>
  );
}
