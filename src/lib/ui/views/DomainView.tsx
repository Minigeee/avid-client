import { useMemo } from 'react';

import {
  ActionIcon,
  Box,
  Center,
  Flex,
  Group,
  Menu,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useClipboard } from '@mantine/hooks';

import { IconChevronDown, IconCopy, IconSettings } from '@tabler/icons-react';

import MainView from '@/lib/ui/views/main/MainView';

import config from '@/config';
import { AppState } from '@/lib/contexts';
import { DomainWrapper, useApp, useDomain, useSession } from '@/lib/hooks';
import { openDomainSettings } from '../modals';


////////////////////////////////////////////////////////////
type DomainHeaderProps = {
  app: AppState;
  domain: DomainWrapper;
}

////////////////////////////////////////////////////////////
function DomainHeader({ app, domain }: DomainHeaderProps) {
  const session = useSession();

  const expansion_id = app.navigation.expansions?.[domain.id] || 'home';
  const expansions = [
    { value: 'home', label: 'Home' },
    { value: 'calendar', label: 'Calendar' },
  ];

  const clipboard = useClipboard({ timeout: 500 });

  // Checks if user can manage any resource
  const canManage = useMemo(() => {
    for (const perms of Object.values(domain._permissions.permissions)) {
      if (perms.has('can_manage'))
        return true;
    }

    return false;
  }, [domain._permissions.permissions]);


  return (
    <Group spacing={0} sx={(theme) => ({
      flexShrink: 0,
      paddingLeft: '0.25rem',
      paddingRight: '0.3rem',
      height: '2.8rem',
      backgroundColor: theme.colors.dark[8],
    })}>
      <Menu width='25ch' position='bottom-start' styles={(theme) => ({
        dropdown: {
          backgroundColor: theme.colors.dark[7],
          borderColor: theme.colors.dark[5],
        },
        item: {
          '&:hover': {
            backgroundColor: theme.colors.dark[6],
          },
        },
      })}>
        <Menu.Target>
          <ActionIcon size='lg' sx={(theme) => ({
            marginRight: '0.3rem',
            color: theme.colors.dark[1],
            '&:hover': {
              backgroundColor: theme.colors.dark[6],
            }
          })}>
            <IconChevronDown size={22} />
          </ActionIcon>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>{domain.name.toUpperCase()}</Menu.Label>
          {canManage && (
            <Menu.Item
              icon={<IconSettings size={16} />}
              onClick={() => openDomainSettings({ domain_id: domain.id })}
            >
              Settings
            </Menu.Item>
          )}

          <Menu.Item icon={<IconCopy size={16} />} onClick={() =>
            clipboard.copy(`${config.domains.site}/join/${domain.id.split(':')[1]}`)
          }>
            Copy Invite URL
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Title order={4}>
        {domain.name}
      </Title>
      <Group spacing={5} sx={{ marginLeft: '1.2rem' }}>
        {expansions.map((expansion, i) => {
          const active = expansion_id === expansion.value;
          return (
            <UnstyledButton key={expansion.value} onClick={() => {
              app._mutators.navigation.setExpansion(expansion.value);
            }}>
              <div>
                <Group spacing='xs' align='start' sx={(theme) => ({
                  padding: '0.45rem 1.0rem',
                  borderRadius: 3,
                  transition: 'background-color 0.1s',
                  '&:hover': {
                    backgroundColor: active ? undefined : theme.colors.dark[6],
                  },
                })}>
                  <Text size='sm' weight={500} sx={(theme) => ({
                    color: theme.colors.dark[active ? 0 : 1],
                  })}>
                    {expansion.label}
                  </Text>
                </Group>
                <Box sx={(theme) => ({
                  height: active ? 4 : 0,
                  background: theme.fn.linearGradient(20, theme.colors.violet[5], theme.colors.pink[5]),
                  borderRadius: 3,
                  transition: 'height 0.1s',
                })} />
              </div>
            </UnstyledButton>
          );
        })}
      </Group>
    </Group>
  );
}


////////////////////////////////////////////////////////////
type DomainViewProps = {
  /** This assumes that the given id is valid (not a dm or calendar id, etc) */
  domain_id?: string;
}

////////////////////////////////////////////////////////////
export default function DomainView({ domain_id }: DomainViewProps) {
  const app = useApp();

  const domain = useDomain(domain_id || '');
  if (!domain._exists)
    return null;

  // Use nav state expansion as default, home as back up
  const expansion_id = app.navigation.expansions?.[domain.id] || 'home';


  return (
    <Flex w='100%' h='100%' direction='column'>
      <DomainHeader app={app} domain={domain} />
      <Box style={{
        flexGrow: 1,
        overflow: 'hidden',
        width: '100%',
        borderTopLeftRadius: 6,
        borderTopRightRadius: 6,
      }}>
        {expansion_id === 'home' && (<MainView />)}
        {expansion_id !== 'home' && (
          <Center w='100%' h='100%'>
            <Text>Coming soon :&#41;</Text>
          </Center>
        )}
      </Box>
    </Flex>
  )
}
