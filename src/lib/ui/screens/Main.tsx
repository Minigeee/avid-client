import { useEffect, useMemo, useState } from 'react';

import {
  ActionIcon,
  Box,
  Center,
  CloseButton,
  Divider,
  Drawer,
  Flex,
  Group,
  Menu,
  ScrollArea,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useClipboard } from '@mantine/hooks';

import {
  IconArrowBarLeft,
  IconCalendar,
  IconChevronDown,
  IconCopy,
  IconEdit,
  IconLogout,
  IconMenu2,
  IconMessage2,
  IconPlus,
  IconSettings,
  IconUserShare,
} from '@tabler/icons-react';

import {
  openCreateDomain,
  openDomainSettings,
  openUserSettings,
} from '@/lib/ui/modals';
import MainView from '@/lib/ui/views/main/MainView';
import ProfileAvatar from '@/lib/ui/components/ProfileAvatar';
import DomainAvatar from '@/lib/ui/components/DomainAvatar';

import config from '@/config';
import { AppState } from '@/lib/contexts';
import {
  DomainWrapper,
  useApp,
  useDomain,
  useProfile,
  useSession,
} from '@/lib/hooks';
import { Domain } from '@/lib/types';
import ActionButton from '../components/ActionButton';

////////////////////////////////////////////////////////////
type DomainButtonProps = {
  domain: Partial<Domain>;
  active: boolean;

  onClick: () => void;
};

////////////////////////////////////////////////////////////
function DomainButton(props: DomainButtonProps) {
  return (
    <UnstyledButton
      sx={(theme) => ({
        padding: '0.5rem 0.75rem',
        backgroundColor: theme.colors.dark[props.active ? 6 : 7],
        borderRadius: theme.radius.md,
        transition: 'background-color 0.08s',
        '&:hover': {
          backgroundColor: theme.colors.dark[6],
        },
      })}
      onClick={props.onClick}
    >
      <Group>
        <DomainAvatar domain={props.domain} size={42} />
        <Box>
          <Text size="md" weight={props.active ? 500 : 400}>
            {props.domain.name}
          </Text>
          {props.domain.quote && (
            <Text size="xs" color="dimmed">
              {props.domain.quote}
            </Text>
          )}
        </Box>
      </Group>
    </UnstyledButton>
  );
}

////////////////////////////////////////////////////////////
type PersonalButtonProps = {
  icon: JSX.Element;
  title: string;

  onClick?: () => void;
};

////////////////////////////////////////////////////////////
function PersonalButton(props: PersonalButtonProps) {
  return (
    <UnstyledButton
      sx={(theme) => ({
        padding: '0.75rem',
        borderRadius: theme.radius.md,
        transition: 'background-color 0.08s',
        '&:hover': {
          backgroundColor: theme.colors.dark[6],
        },
      })}
      onClick={props.onClick}
    >
      <Group>
        {props.icon}
        <Text size="md">{props.title}</Text>
      </Group>
    </UnstyledButton>
  );
}

////////////////////////////////////////////////////////////
type AppDrawerProps = {
  /** Determines if the drawer should be opened */
  opened: boolean;
  /** Called when drawer should be closed */
  onClose: () => void;
};

////////////////////////////////////////////////////////////
function AppDrawer({ opened, onClose, ...props }: AppDrawerProps) {
  const app = useApp();
  const session = useSession();
  const profile = useProfile(session.profile_id);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      padding={0}
    >
      <Flex direction="column" h="100vh">
        <Group
          mih="10rem"
          sx={(theme) => ({
            position: 'relative',
            backgroundColor: theme.colors.dark[9],
          })}
        >
          <CloseButton
            size="md"
            sx={{
              position: 'absolute',
              top: '0.5rem',
              right: '0.5rem',
            }}
            onClick={onClose}
          />
        </Group>

        <Group
          p={16}
          sx={(theme) => ({
            borderBottom: `1px solid ${theme.colors.dark[5]}`,
          })}
        >
          <ProfileAvatar profile={profile} size={64} />
          <Stack spacing={0}>
            <Title order={4}>{profile.username}</Title>
            <Text size="sm" color="dimmed">
              {session.email}
            </Text>
          </Stack>

          <div style={{ flexGrow: 1 }} />
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon size="lg">
                <IconChevronDown />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown miw="10rem">
              <Menu.Item
                icon={<IconEdit size={18} />}
                onClick={() => {
                  onClose();
                  openUserSettings({});
                }}
              >
                Edit profile
              </Menu.Item>

              <Menu.Divider />
              <Menu.Item icon={<IconUserShare size={18} />}>
                Switch profile
              </Menu.Item>
              <Menu.Item icon={<IconLogout size={18} />} color="red">
                Logout
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        <Stack
          spacing={0}
          sx={(theme) => ({
            padding: '0.5rem 0.25rem',
            borderBottom: `1px solid ${theme.colors.dark[5]}`,
          })}
        >
          <PersonalButton title="Messages" icon={<IconMessage2 size={22} />} />
          <PersonalButton title="Calendar" icon={<IconCalendar size={22} />} />
        </Stack>

        <Text size="sm" color="dimmed" weight={600} mt={8} ml={12}>
          Domains
        </Text>
        <ScrollArea sx={{ flexGrow: 1 }}>
          <Stack
            spacing={0}
            sx={(theme) => ({
              padding: '0.25rem 0.25rem',
            })}
          >
            {profile.domains?.map((domain) => (
              <DomainButton
                key={domain.id}
                domain={domain}
                active={domain.id === app.domain}
                onClick={() => {
                  if (domain.id !== app.domain) {
                    onClose();

                    // Switch domain in separate thread to prevent ui freeze
                    setTimeout(() => app._mutators.setDomain(domain.id), 0);
                  }
                }}
              />
            ))}
          </Stack>
        </ScrollArea>

        <Group
          spacing={2}
          p="0.5rem"
          sx={(theme) => ({
            borderTop: `1px solid ${theme.colors.dark[5]}`,
          })}
        >
          <ActionButton
            tooltip="Settings"
            size="xl"
            hoverBg={(theme) => theme.colors.dark[6]}
            onClick={() => {
              onClose();
              openUserSettings({});
            }}
          >
            <IconSettings size={24} />
          </ActionButton>

          <div style={{ flexGrow: 1 }} />

          <ActionButton
            tooltip="New Domain"
            size="xl"
            hoverBg={(theme) => theme.colors.dark[6]}
            onClick={() => {
              if (profile._exists) {
                onClose();

                openCreateDomain({
                  profile,
                  onCreate: (domain_id) => {
                    // Switch to new domain
                    app._mutators.setDomain(domain_id);
                  },
                });
              }
            }}
          >
            <IconPlus size={24} />
          </ActionButton>
        </Group>
      </Flex>
    </Drawer>
  );
}

////////////////////////////////////////////////////////////
type AppHeaderProps = {
  app: AppState;
  domain?: DomainWrapper;
};

////////////////////////////////////////////////////////////
function AppHeader({ app, domain }: AppHeaderProps) {
  const [menuOpened, setMenuOpened] = useState<boolean>(false);

  const clipboard = useClipboard({ timeout: 500 });

  // Checks if user can manage any resource
  const canManageDomain = useMemo(() => {
    if (!domain) return false;
    if (domain._permissions.is_admin) return true;
    for (const perms of Object.values(domain._permissions.permissions)) {
      if (perms.has('can_manage')) return true;
    }

    return false;
  }, [domain?._permissions.permissions]);

  return (
    <>
      <AppDrawer opened={menuOpened} onClose={() => setMenuOpened(false)} />

      <Group
        spacing={0}
        sx={(theme) => ({
          flexShrink: 0,
          paddingLeft: '0.75rem',
          paddingRight: '0.3rem',
          height: '3.0rem',
          backgroundColor: theme.colors.dark[8],
        })}
      >
        <ActionIcon
          size="lg"
          sx={(theme) => ({
            marginRight: '0.75rem',
            color: theme.colors.dark[1],
            '&:hover': {
              backgroundColor: theme.colors.dark[6],
            },
          })}
          onClick={() => setMenuOpened(true)}
        >
          <IconMenu2 size={22} />
        </ActionIcon>

        <Group spacing={8}>
          {domain && <DomainAvatar domain={domain} size={32} />}
          <Title
            order={4}
            size="1.25rem"
            sx={{ lineHeight: 1, marginLeft: '0.125rem' }}
          >
            {domain?.name}
          </Title>

          {domain && (
            <Menu
              width="15rem"
              position="bottom-start"
              styles={(theme) => ({
                dropdown: {
                  backgroundColor: theme.colors.dark[7],
                  borderColor: theme.colors.dark[5],
                },
                item: {
                  '&:hover': {
                    backgroundColor: theme.colors.dark[6],
                  },
                },
              })}
            >
              <Menu.Target>
                <ActionIcon
                  sx={(theme) => ({
                    marginTop: '0.25rem',
                    '&:hover': { backgroundColor: theme.colors.dark[6] },
                  })}
                >
                  <IconChevronDown size={22} />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>{domain.name.toUpperCase()}</Menu.Label>
                {canManageDomain && (
                  <Menu.Item
                    icon={<IconSettings size={16} />}
                    onClick={() => openDomainSettings({ domain_id: domain.id })}
                  >
                    Settings
                  </Menu.Item>
                )}

                <Menu.Item
                  icon={<IconCopy size={16} />}
                  onClick={() =>
                    clipboard.copy(
                      `${config.domains.site}/join/${domain.id.split(':')[1]}`,
                    )
                  }
                >
                  Copy Invite URL
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </Group>
    </>
  );
}

////////////////////////////////////////////////////////////
export default function Main(props: { visible: boolean }) {
  const app = useApp();
  const session = useSession();

  const profile = useProfile(session.profile_id);
  const domain = useDomain(
    app.domain?.startsWith('domains') ? app.domain : undefined,
  );

  // Set initial domain if remote nav state does not exist
  useEffect(() => {
    if (!app._loaded) return;
    if (!app.domain && profile.domains?.length)
      app._mutators.setDomain(profile.domains[0].id);
  }, [app._loaded]);

  return (
    <Flex
      w="100vw"
      h="100vh"
      gap={0}
      sx={(theme) => ({
        backgroundColor: theme.colors.dark[8],
        display: props.visible ? undefined : 'none',
      })}
      onContextMenu={(e) => {
        if (!config.dev_mode) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <Flex
        direction="column"
        sx={{
          flexGrow: 1,
          height: '100%',
        }}
      >
        <AppHeader app={app} domain={domain._exists ? domain : undefined} />
        {domain._exists && <MainView />}
        {app.domain && !app.domain.startsWith('domains') && (
          <Center w="100%" h="100%">
            <Text>Coming soon :&#41;</Text>
          </Center>
        )}
      </Flex>
    </Flex>
  );
}
