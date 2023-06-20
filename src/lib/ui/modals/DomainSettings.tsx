import { ReactNode, RefObject, forwardRef, useEffect, useMemo, useRef, useState } from 'react';

import {
  ActionIcon,
  Affix,
  Box,
  Button,
  Center,
  CloseButton,
  ColorInput,
  ColorSwatch,
  DEFAULT_THEME,
  Divider,
  Flex,
  Group,
  Popover,
  ScrollArea,
  Select,
  Stack,
  Switch,
  SwitchProps,
  Tabs,
  Text,
  TextInput,
  Title,
  Transition,
  UnstyledButton
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { ContextModalProps, openConfirmModal } from '@mantine/modals';
import { UseFormReturnType } from '@mantine/form/lib/types';

import { IconAlertCircle, IconBadge, IconBadgeOff, IconBuildingCommunity, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';

import { useImageModal } from '.';
import ActionButton from '@/lib/ui/components/ActionButton';
import ChannelIcon from '@/lib/ui/components/ChannelIcon';
import DataTable from '@/lib/ui/components/DataTable';
import DomainAvatar from '@/lib/ui/components/DomainAvatar';
import { Emoji, EmojiPicker } from '@/lib/ui/components/Emoji';
import SettingsMenu from '@/lib/ui/components/SettingsMenu';

import config from '@/config';
import { AppState, SessionState } from '@/lib/contexts';
import { DomainWrapper, useAclEntries, useApp, useDomain, useMemoState, useProfile, useSession } from '@/lib/hooks';
import { AllChannelPermissions, AllPermissions, ChannelTypes, Role } from '@/lib/types';
import { diff } from '@/lib/utility';


////////////////////////////////////////////////////////////
const TABS = {
  'Domain Settings': [
    { value: 'general', label: 'General' },
    { value: 'roles', label: 'Roles' },
  ],
};
let FLATTENED: { value: string; label: string }[] = [];
for (const tabs of Object.values(TABS))
  FLATTENED = FLATTENED.concat(tabs);
  
////////////////////////////////////////////////////////////
const PRESET_COLORS: string[] = [];
for (const [name, colors] of Object.entries(DEFAULT_THEME.colors)) {
  if (name === 'red' || name === 'gray' || name === 'yellow' || name === 'lime')
    PRESET_COLORS.push(colors[7]);
  else if (name !== 'dark')
    PRESET_COLORS.push(colors[6]);
}
PRESET_COLORS.push(DEFAULT_THEME.colors.gray[6]);

////////////////////////////////////////////////////////////
type TabProps = {
  app: AppState;
  session: SessionState;
  domain: DomainWrapper;

  /** Modal body ref */
  bodyRef: RefObject<HTMLDivElement>;
};


////////////////////////////////////////////////////////////
type UnsavedChangesProps<T> = {
  bodyRef: RefObject<HTMLDivElement>;
  form: UseFormReturnType<T>;
  onSubmit?: () => Promise<void>;
};

////////////////////////////////////////////////////////////
function UnsavedChanges<T>({ bodyRef, form, ...props }: UnsavedChangesProps<T>) {
  const [loading, setLoading] = useState<boolean>(false);

  return (
    <Transition mounted={bodyRef.current !== null && form.isDirty()} transition='pop-bottom-right' duration={200}>
      {(styles) => (
        <Affix target={bodyRef.current || undefined} position={{ bottom: '0.75rem', right: '0.75rem' }}>
          <Group
            spacing={8}
            w='30rem'
            p='0.5rem 0.5rem 0.5rem 0.8rem'
            sx={(theme) => ({
              backgroundColor: theme.colors.dark[8],
              boxShadow: '0px 0px 12px #00000030',
              '.tabler-icon': { color: theme.colors.dark[4], marginBottom: 1 },
            })}
            style={styles}
          >
            <IconAlertCircle size='1.5rem' />
            <Text ml={4}>You have unsaved changes</Text>
            <div style={{ flexGrow: 1 }} />

            <Button
              variant='default'
              onClick={() => form.reset()}
            >
              Cancel
            </Button>
            <Button
              variant='gradient'
              loading={loading}
              onClick={async () => {
                if (!props.onSubmit) return;

                try {
                  setLoading(true);
                  await props.onSubmit();

                  // Reset dirty
                  form.resetDirty();
                }
                finally {
                  setLoading(false);
                }
              }}
            >
              Save
            </Button>
          </Group>
        </Affix>
      )}
    </Transition>
  );
}


////////////////////////////////////////////////////////////
function GeneralTab({ domain, ...props }: TabProps) {
  const profile = useProfile(props.session.profile_id);

  const { ImageModal, open: openImageModal } = useImageModal();

  return (
    <>
      <ImageModal
        subtext='Image must not exceed 2MB.'
        maxSize={2 * 1024 ** 2}
        imgSize={config.upload.profile_picture.image_size}
        size='md'

        onUpload={async (image, fname) => {
          if (image) {
            await domain._mutators.setIcon(image, fname);

            // Apply change to profile
            if (profile._exists)
              profile._refresh();
          }
        }}
      />

      <Stack>
        <Title order={3}>Domain Icon</Title>

        <Group spacing='xl' sx={(theme) => ({
          padding: '1.2rem',
          backgroundColor: theme.colors.dark[8],
          borderRadius: theme.radius.md,
        })}>
          <DomainAvatar domain={domain} size={120} />
          <Stack spacing='sm'>
            <Group spacing='sm'>
              <Button
                variant='gradient'
                onClick={openImageModal}
              >
                {domain.icon ? 'Change' : 'Upload'} Image
              </Button>

              {domain.icon && (
                <ActionButton
                  tooltip='Remove Image'
                  tooltipProps={{ position: 'right' }}
                  size='lg'
                  sx={(theme) => ({
                    color: theme.colors.dark[1],
                    '&:hover': {
                      backgroundColor: theme.colors.dark[5],
                    },
                  })}
                  onClick={() => {
                    openConfirmModal({
                      title: 'Remove Domain Icon',
                      labels: { cancel: 'Cancel', confirm: 'Remove' },
                      children: 'Are you sure you want to remove the domain icon picture?',
                      groupProps: {
                        spacing: 'xs',
                        sx: { marginTop: '0.5rem' },
                      },
                      confirmProps: {
                        color: 'red',
                      },

                      // Optimistic mutation
                      onConfirm: async () => {
                        // Remove domain icon picture
                        await domain._mutators.removeIcon();

                        // Apply change to profile
                        if (profile._exists)
                          profile._refresh();
                      },
                    })
                  }}
                >
                  <IconTrash size={22} />
                </ActionButton>
              )}
            </Group>
            <Text size='xs' color='dimmed'>Domain icons are resized to {config.upload.profile_picture.image_size.w}x{config.upload.profile_picture.image_size.h}</Text>
          </Stack>
        </Group>

        <Divider />
        <Title order={3}>Domain Settings</Title>

        <TextInput
          label='Domain Name'
          value={domain.name}
          disabled
          sx={{ width: config.app.ui.short_input_width }}
        />
      </Stack>
    </>
  );
}


////////////////////////////////////////////////////////////
type PermissionSettingProps = {
  title: string;
  description: ReactNode;
  withDivider?: boolean;

  switchProps?: SwitchProps;
};

////////////////////////////////////////////////////////////
function PermissionSetting(props: PermissionSettingProps) {
  return (
    <>
      <Flex maw={config.app.ui.settings_maw} wrap='nowrap' gap='1.0rem'>
        <Box sx={{ flexGrow: 1 }}>
          <Text size='md' weight={600} mb={4}>{props.title}</Text>
          <Text size='sm' color='dimmed' maw='40rem'>
            {props.description}
          </Text>
        </Box>

        <Switch {...props.switchProps} />
      </Flex>

      {props.withDivider !== false && (
        <Divider maw={config.app.ui.settings_maw} sx={(theme) => ({ borderColor: theme.colors.dark[5] })} />
      )}
    </>
  );
}

////////////////////////////////////////////////////////////
function RolesTab({ domain, ...props }: TabProps) {
  // Domain permissions
  const aclEntries = useAclEntries(domain.id);

  // Settings form
  const initialValues = useMemo(() => {
    function hasPerm(list: AllPermissions[] | undefined, permission: AllPermissions) {
      return list ? list.findIndex(x => x === permission) >= 0 : false;
    }

    // Map of domain permissions per role
    const domainPermissions: Record<string, {
      can_manage: boolean;
      can_manage_invites: boolean;
      can_create_resources: boolean;
      can_manage_extensions: boolean;
      can_create_roles: boolean;
    }> = {};

    for (const role of domain.roles) {
      const entry = aclEntries.data?.find(x => x.role === role.id);
      domainPermissions[role.id] = {
        can_manage: hasPerm(entry?.permissions, 'can_manage'),
        can_manage_invites: hasPerm(entry?.permissions, 'can_manage_invites'),
        can_create_resources: hasPerm(entry?.permissions, 'can_create_resources'),
        can_manage_extensions: hasPerm(entry?.permissions, 'can_manage_extensions'),
        can_create_roles: hasPerm(entry?.permissions, 'can_create_roles'),
      };
    }

    return {
      roles: domain.roles.map(role => ({
        ...role,
        badge: role.badge || null,
        color: role.color || '',
      })),
      domain_permissions: domainPermissions,
    };
  }, [aclEntries.data, domain.roles]);
  const form = useForm({ initialValues });

  // Chosen role index
  const [roleIdx, setRoleIdx] = useState<number | null>(null);
  // Is badge picker open
  const [badgePickerOpen, setBadgePickerOpen] = useState<boolean>(false);


  // Current role
  const role = roleIdx !== null ? form.values.roles[roleIdx] : null;

  return (
    <>
      <Stack spacing='md' pb='5rem'>
        <Text size='sm' color='dimmed' maw='100ch'>
          Roles are labels that can be assigned to members to indicate their designated position or responsibilities.
          Each role has a customizable set of permissions for precise control over their actions and access levels.
        </Text>

        <Box>
          <Title order={3}>Roles</Title>
          <Text size='sm' color='dimmed'>
            Role tags and badges will be displayed in the order they appear in this list.
          </Text>
        </Box>

        <Box>
          <Group maw={config.app.ui.settings_maw} align='end' spacing='xs' mb={8}>
            <TextInput
              placeholder='Search'
              icon={<IconSearch size={18} />}
              style={{ flexGrow: 1 }}
            />
            <Button
              variant='gradient'
            >
              New Role
            </Button>
          </Group>

          <ScrollArea.Autosize maw={config.app.ui.settings_maw} sx={(theme) => ({
            padding: '0.5rem',
            backgroundColor: theme.colors.dark[8],
          })}>
            <Stack spacing={0}>
              {form.values.roles.map((role, idx) => (
                <UnstyledButton
                  sx={(theme) => ({
                    padding: '0.4rem 0.6rem',
                    backgroundColor: roleIdx === idx ? theme.colors.dark[7] : undefined,
                    transition: 'background-color, 0.08s',

                    '&:hover': {
                      backgroundColor: theme.colors.dark[7],
                    },
                  })}
                  onClick={() => setRoleIdx(idx)}
                >
                  <Group spacing='xs'>
                    <Box h='1.5rem' pt={2} sx={(theme) => ({ color: theme.colors.dark[3] })}>
                      {role.badge ? (<Emoji id={role.badge} size='1rem' />) : (<IconBadgeOff size={19} />)}
                    </Box>
                    <Text inline size='sm' weight={600} sx={{ flexGrow: 1 }}>
                      {role.id === domain._default_role ? '@' : ''}{role.label}
                    </Text>
                    {role.color && <ColorSwatch color={role.color} size='1.0rem' />}
                  </Group>
                </UnstyledButton>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        </Box>

        {role && (
          <>
          <Divider sx={(theme) => ({ borderColor: theme.colors.dark[5] })} />
          <Title order={3} mb={8}>Edit - {role.id === domain._default_role ? '@' : ''}{role.label}</Title>

          <Tabs variant='outline' defaultValue='general'>
            <Tabs.List>
              <Tabs.Tab value='general'>General</Tabs.Tab>
              <Tabs.Tab value='managers'>Managers</Tabs.Tab>
              <Tabs.Tab value='permissions'>Permissions</Tabs.Tab>
              <Tabs.Tab value='members'>Members</Tabs.Tab>
            </Tabs.List>

            {/* General */}
            <Tabs.Panel value='general'>
              <Stack mt={20}>
                <TextInput
                  label='Name'
                  sx={{ width: config.app.ui.med_input_width }}
                  {...form.getInputProps(`roles.${roleIdx}.label`)}
                />

                <ColorInput
                  label='Color'
                  description={`The role color affects the colored tags displayed in a user's profile`}
                  placeholder='None'
                  swatchesPerRow={7}
                  swatches={PRESET_COLORS}
                  styles={{ wrapper: { maxWidth: config.app.ui.med_input_width } }}
                  {...form.getInputProps(`roles.${roleIdx}.color`)}
                />

                <div>
                  <Text size='sm' weight={600}>Badge</Text>
                  <Text size='xs' color='dimmed' mb={6}>
                    A role badge is an icon displayed next to a user's names in chat
                  </Text>

                  <Group mt={8} spacing='sm'>
                    <Center sx={(theme) => ({
                      height: '2.75rem',
                      width: '2.75rem',
                      backgroundColor: role.badge ? undefined : theme.colors.dark[8],
                      color: theme.colors.dark[3],
                      borderRadius: '3rem',
                    })}>
                      {role.badge ? (<Emoji id={role.badge} size='2rem' />) : (<IconBadgeOff size='1.75rem' />)}
                    </Center>

                    <Popover
                      opened={badgePickerOpen}
                      withinPortal
                      withArrow
                      onClose={() => setBadgePickerOpen(false)}
                    >
                      <Popover.Target>
                        <Button variant='default' ml={4} onClick={() => setBadgePickerOpen(!badgePickerOpen)}>
                          {role.badge ? 'Change' : 'Add'} Badge
                        </Button>
                      </Popover.Target>
                      <Popover.Dropdown p='0.75rem 1rem' sx={(theme) => ({
                        backgroundColor: theme.colors.dark[7],
                        borderColor: theme.colors.dark[5],
                        boxShadow: '0px 4px 16px #00000030',
                      })}>
                        <EmojiPicker
                          emojiSize={32}
                          onSelect={(emoji) => {
                            form.setFieldValue(`roles.${roleIdx}.badge`, emoji.id);
                            setBadgePickerOpen(false);
                          }}
                        />
                      </Popover.Dropdown>
                    </Popover>

                    {role.badge && (
                      <CloseButton
                        size='md'
                        onClick={() => form.setFieldValue(`roles.${roleIdx}.badge`, null)}
                      />
                    )}
                  </Group>
                </div>
              </Stack>
            </Tabs.Panel>
            
            {/* Permissions */}
              <Tabs.Panel value='permissions'>
                <Stack mt={20}>
                  <Box mb={8}>
                    <Group spacing='xs' mb={4}>
                      <IconBuildingCommunity size={19} />
                      <Title order={4}>Domain Permissions</Title>
                    </Group>
                    <Text size='sm' color='dimmed'>
                      General permissions that apply to the domain.
                    </Text>
                  </Box>

                  <PermissionSetting
                    title='Manage Domain'
                    description='Allows users with this role to manage domain settings, including the domain name, icon, and banner.'
                    switchProps={form.getInputProps(`domain_permissions.${role.id}.can_manage`, { type: 'checkbox' })}
                  />

                  <PermissionSetting
                    title='Manage Invites'
                    description='Allows users with this role to create, edit, and delete invites to the domain.'
                    switchProps={form.getInputProps(`domain_permissions.${role.id}.can_manage_invites`, { type: 'checkbox' })}
                  />

                  <PermissionSetting
                    title='Manage Extensions'
                    description='Allows users with this role to add and manage the extensions of this domain.'
                    switchProps={form.getInputProps(`domain_permissions.${role.id}.can_manage_extensions`, { type: 'checkbox' })}
                  />

                  <PermissionSetting
                    title='Create Roles'
                    description='Allows users with this role to create and manage new roles within this domain, but does not allow them to edit or delete any existing role that they do not already have permissions for. This role will not be able to create new roles with permissions that this role does not have. To enable more precise role management capabilities, assign this role as a "Manager" to the specific roles it should handle.'
                    switchProps={form.getInputProps(`domain_permissions.${role.id}.can_create_roles`, { type: 'checkbox' })}
                    withDivider={false}
                  />

                  {/* <Divider maw={config.app.ui.settings_maw} mt={16} />
                  <Box mb={12}>
                    <Group spacing='xs' mb={4}>
                      <ChannelIcon type='text' size={20} />
                      <Title order={4}>Chat Permissions</Title>
                    </Group>
                    <Text size='sm' color='dimmed' maw={config.app.ui.settings_maw}>
                      Default permissions for new and existing text channels. These permissions can be customized within each specific channel to provide finer control over access and permissions.
                    </Text>
                  </Box>

                  <PermissionSetting
                    title='Send Messages'
                    description='Allows users with this role to send messages in text channels.'
                    switchProps={form.getInputProps(`roles.${roleIdx}.permissions.text.can_send_messages`, { type: 'checkbox' })}
                  />

                  <PermissionSetting
                    title='Send Attachments'
                    description='Allows users with this role to send file attachments in text channels.'
                    switchProps={form.getInputProps(`roles.${roleIdx}.permissions.text.can_send_attachments`, { type: 'checkbox' })}
                  />

                  <PermissionSetting
                    title='Delete Messages'
                    description='Allows users with this role to delete messages sent by other users in text channels.'
                    switchProps={form.getInputProps(`roles.${roleIdx}.permissions.text.can_delete_messages`, { type: 'checkbox' })}
                    withDivider={false}
                  />

                  <Divider maw={config.app.ui.settings_maw} mt={16} />
                  <Box mb={12}>
                    <Group spacing='xs' mb={4}>
                      <ChannelIcon type='rtc' size={20} />
                      <Title order={4}>Voice & Video Permissions</Title>
                    </Group>
                    <Text size='sm' color='dimmed' maw={config.app.ui.settings_maw}>
                      Default permissions for new and existing voice & video channels. These permissions can be customized within each specific channel to provide finer control over access and permissions. Voice & video channels will be referred to as RTC channels.
                    </Text>
                  </Box>

                  <PermissionSetting
                    title='Broadcast Audio'
                    description='Allows users with this role to broadcast audio using their microphone in RTC channels.'
                    switchProps={form.getInputProps(`roles.${roleIdx}.permissions.rtc.can_broadcast_audio`, { type: 'checkbox' })}
                  />

                  <PermissionSetting
                    title='Broadcast Video'
                    description='Allows users with this role to broadcast video using their webcam or screenshare in RTC channels.'
                    switchProps={form.getInputProps(`roles.${roleIdx}.permissions.rtc.can_broadcast_video`, { type: 'checkbox' })}
                  />

                  <PermissionSetting
                    title='Manage Participants'
                    description='Allows users with this role to manage other participants in RTC channels. Users with this permission are able to mute, deafen, force-stop video broadcasts, move, kick, or ban other participants within an RTC channel.'
                    switchProps={form.getInputProps(`roles.${roleIdx}.permissions.rtc.can_manage_participants`, { type: 'checkbox' })}
                    withDivider={false}
                  />

                  <Divider maw={config.app.ui.settings_maw} mt={16} />
                  <Box mb={12}>
                    <Group spacing='xs' mb={4}>
                      <ChannelIcon type='board' size={19} />
                      <Title order={4}>Board Permissions</Title>
                    </Group>
                    <Text size='sm' color='dimmed' maw={config.app.ui.settings_maw}>
                      Default permissions for new and existing task boards. These permissions can be customized within each specific board to provide finer control over access and permissions.
                    </Text>
                  </Box>

                  <PermissionSetting
                    title='Manage Tasks'
                    description='Allows users with this role to create, edit, and delete any task within a board, regardless of assignee.'
                    switchProps={form.getInputProps(`roles.${roleIdx}.permissions.board.can_manage_tasks`, { type: 'checkbox' })}
                  />

                  <PermissionSetting
                    title='Manage Own Tasks'
                    description='Allows users with this role to create, edit, and delete their own tasks within a board.'
                    switchProps={form.getInputProps(`roles.${roleIdx}.permissions.board.can_manage_own_tasks`, { type: 'checkbox' })}
                    withDivider={false}
                  /> */}
              </Stack>
            </Tabs.Panel>
          </Tabs>
          </>
        )}

      </Stack>

      <UnsavedChanges
        bodyRef={props.bodyRef}
        form={form}
        onSubmit={async () => {
          // Recreate original roles
          const original: Record<string, Role> = {};
          for (const role of initialValues.roles)
            original[role.id] = role;

          // Detect changes
          const unaccounted = new Set<string>(Object.keys(original));
          const changes: Record<string, Partial<Role>> = {};
          const newRoles: Record<string, Partial<Role>> = {};

          for (let i = 0; i < form.values.roles.length; ++i) {
            const role = form.values.roles[i];
            
            // Create new role if role is new
            if (!unaccounted.has(role.id)) {
              newRoles[role.id] = {
                ...role,
                badge: role.badge || undefined,
                color: role.color || undefined,
              };
            }

            // Add diff it role changed
            else {
              const roleDiff = diff(initialValues.roles[i], role);

              // Record diff
              if (roleDiff !== undefined)
                changes[role.id] = roleDiff;

              // Mark as accounted for
              unaccounted.delete(role.id);
            }
          }

          // The remaining values in unaccounted are deleted
          if (unaccounted.size > 0 || Object.keys(changes).length > 0 || Object.keys(newRoles).length > 0) {
            await domain._mutators.updateRoles({
              added: Object.values(newRoles),
              changed: changes,
              deleted: Array.from(unaccounted),
            });
          }

          // Set permissions if changed
          const domainPermsDiff = diff(initialValues.domain_permissions, form.values.domain_permissions);
          if (aclEntries._exists && domainPermsDiff && Object.keys(domainPermsDiff).length > 0) {
            // Get permissions list for each one that changed
            const permChanges: Record<string, AllPermissions[]> = {};
            for (const role_id of Object.keys(domainPermsDiff || {}))
              permChanges[role_id] = Object.entries(form.values.domain_permissions[role_id]).filter(([k, v]) => v).map(x => x[0]).sort() as AllPermissions[];

            // Mutation
            await aclEntries._mutators.setPermissions(permChanges);
          }
        }}
      />
    </>
  );
}


////////////////////////////////////////////////////////////
export type DomainSettingsProps = {
  /** The id of the domain to show settings for */
  domain_id: string;
  /** The starting tab */
  tab?: string;
};

////////////////////////////////////////////////////////////
export default function DomainSettings({ context, id, innerProps: props }: ContextModalProps<DomainSettingsProps>) {
  const app = useApp();
  const session = useSession();
  const domain = useDomain(props.domain_id);

  // Modal body
  const bodyRef = useRef<HTMLDivElement>(null);

  // Current tab
  const [tab, setTab] = useMemoState(() => {
    const tabId = props.tab || 'roles';
    return FLATTENED.find(x => x.value === tabId);
  }, [props.tab]);


  if (!domain._exists) return null;
  const tabProps = { app, session, domain, bodyRef };

  return (
    <Flex ref={bodyRef} w='100%' h='100%'>
      <SettingsMenu
        values={TABS}
        value={tab?.value || ''}
        onChange={(value, label) => setTab({ label, value })}
        scrollAreaProps={{
          w: '30ch',
          pt: 10,
          sx: (theme) => ({ backgroundColor: theme.colors.dark[6] }),
        }}
      />

      <Flex h='100%' direction='column' sx={(theme) => ({
        flexGrow: 1,
        backgroundColor: theme.colors.dark[7],
      })}>
        <Flex align='end' mb={4} sx={(theme) => ({
          padding: '1.0rem 1.5rem',
          borderBottom: `1px solid ${theme.colors.dark[5]}`,
        })}>
          <Title order={2}>{tab?.label}</Title>
          <div style={{ flexGrow: 1 }} />
          <CloseButton
            size='lg'
            iconSize={24}
            onClick={() => context.closeModal(id)}
          />
        </Flex>

        <ScrollArea sx={{ flexGrow: 1, padding: '1.0rem 1.5rem' }}>
          {tab?.value === 'general' && (<GeneralTab {...tabProps} />)}
          {tab?.value === 'roles' && (<RolesTab {...tabProps} />)}
        </ScrollArea>
      </Flex>
    </Flex>
  );
}