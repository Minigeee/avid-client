import { useMemo } from 'react';

import {
  Avatar,
  Box,
  Divider,
  Flex,
  Group,
  ScrollArea,
  Stack,
  Tooltip,
  Transition,
} from '@mantine/core';

import { Calendar, Message2, Plus, Settings } from 'tabler-icons-react';

import { useApp, useProfile, useSession } from '@/lib/hooks';
import { Domain } from '@/lib/types';
import { openCreateDomain } from '../modals';

const AVATAR_RADIUS = 24;


////////////////////////////////////////////////////////////
type DomainAvatarProps = {
  domain: Partial<Domain>;
  icon?: JSX.Element;
  active: boolean;
  onClick: () => unknown;
};

////////////////////////////////////////////////////////////
function DomainAvatar({ domain, icon, active, ...props }: DomainAvatarProps) {
  // Avatar content
  const content = useMemo<string | JSX.Element>(() => {
    if (icon)
      return icon;
    else if (domain.name)
      return domain.name.split(/[\s_]+/).map(x => x.charAt(0)).join('').toUpperCase();

    return '';
  }, [domain.name]);

  return (
    <Group spacing={0} position='right'>
      <Transition mounted={active} transition='slide-right' duration={180}>
        {(styles) => (
          <Box style={styles} sx={(theme) => ({
            height: 2 * AVATAR_RADIUS - 6,
            width: 4,
            background: theme.fn.linearGradient(50, theme.colors.violet[5], theme.colors.pink[5]),
            borderTopRightRadius: 5,
            borderBottomRightRadius: 5,
          })} />
        )}
      </Transition>
      <Tooltip
        label={domain.name}
        position='right'
        transitionProps={{ transition: 'fade' }}
        withArrow
        withinPortal
      >
        <Avatar
          size={2 * AVATAR_RADIUS}
          sx={(theme) => ({
            cursor: 'pointer',
            margin: '0.25rem 0.4rem',
            backgroundColor: theme.colors.dark[active ? 4 : 5],
            borderRadius: active ? 0.6 * AVATAR_RADIUS : AVATAR_RADIUS,
            transition: 'background-color 0.1s, border-radius 0.1s',
            '&:hover': {
              borderRadius: 0.6 * AVATAR_RADIUS,
              backgroundColor: theme.colors.dark[4],
            },
            '&:active': {
              transform: 'translateY(1px)',
            }
          })}
          onClick={props.onClick}
        >
          {content}
        </Avatar>
      </Tooltip>
    </Group>
  );
}


////////////////////////////////////////////////////////////
const PERSONAL_TABS = [
  {
    id: 'dms',
    name: 'Direct Messages',
    icon: <Message2 size={25} />,
  },
  {
    id: 'calendar',
    name: 'Calendar',
    icon: <Calendar size={22} />,
  },
];

////////////////////////////////////////////////////////////
export default function DomainBar() {
  const app = useApp();
  const session = useSession();

  const profile = useProfile(session.profile_id);


  ////////////////////////////////////////////////////////////
  return (
    <Flex direction='column' h='100%'>
      <ScrollArea sx={{ flexGrow: 1 }}>
        <Stack spacing={0} sx={{ marginTop: '0.18rem' }}>
          {PERSONAL_TABS.map((tab, i) => (
            <DomainAvatar
              domain={{
                id: tab.id,
                name: tab.name,
              }}
              icon={tab.icon}
              active={app.navigation.domain === tab.id}
              onClick={() => app._mutators.navigation.setDomain(tab.id)}
            />
          ))}
          <Divider sx={{ margin: '0.25rem 0.5rem 0.25rem calc(0.5rem + 4px)' }} />
          {profile.domains?.map((domain, i) => (
            <DomainAvatar
              domain={domain}
              active={app.navigation.domain === domain.id}
              onClick={() => app._mutators.navigation.setDomain(domain.id)}
            />
          ))}
        </Stack>
      </ScrollArea>

      <Divider sx={{ margin: '0.25rem 0.5rem 0.25rem calc(0.5rem + 4px)' }} />

      <Tooltip
        label='New Domain'
        position='right'
        transitionProps={{ transition: 'fade' }}
        withArrow
        withinPortal
      >
        <Avatar
          size={2 * AVATAR_RADIUS}
          sx={(theme) => ({
            cursor: 'pointer',
            margin: '0.25rem 0.4rem 0.25rem calc(0.4rem + 4px)',
            borderRadius: AVATAR_RADIUS,
            transition: 'background-color 0.1s, border-radius 0.1s',
            '&:hover': {
              borderRadius: 0.6 * AVATAR_RADIUS,
              backgroundColor: theme.colors.dark[6],
            },
            '&:active': {
              transform: 'translateY(1px)',
            }
          })}
          onClick={() => {
            if (profile._exists) {
              openCreateDomain({
                profile,
                onCreate: (domain_id) => {
                  // Switch to new domain
                  app._mutators.navigation.setDomain(domain_id);
                },
              });
            }
          }}
        >
          <Plus size={26} />
        </Avatar>
      </Tooltip>

      <Tooltip
        label='Settings'
        position='right'
        transitionProps={{ transition: 'fade' }}
        withArrow
        withinPortal
      >
        <Avatar
          size={2 * AVATAR_RADIUS}
          sx={(theme) => ({
            cursor: 'pointer',
            margin: '0.25rem 0.4rem 0.25rem calc(0.4rem + 4px)',
            borderRadius: AVATAR_RADIUS,
            transition: 'background-color 0.1s, border-radius 0.1s',
            '&:hover': {
              borderRadius: 0.6 * AVATAR_RADIUS,
              backgroundColor: theme.colors.dark[6],
            },
            '&:active': {
              transform: 'translateY(1px)',
            }
          })}
        >
          <Settings size={24} />
        </Avatar>
      </Tooltip>
    </Flex>
  );
}