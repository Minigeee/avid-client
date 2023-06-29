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

import { IconAlertCircle, IconBadge, IconBadgeOff, IconBuildingCommunity, IconCheck, IconPlus, IconSearch, IconTrash, IconX } from '@tabler/icons-react';

import { openChannelGroupSettings, useImageModal } from '.';
import ActionButton from '@/lib/ui/components/ActionButton';
import ChannelIcon from '@/lib/ui/components/ChannelIcon';
import DataTable from '@/lib/ui/components/DataTable';
import DomainAvatar from '@/lib/ui/components/DomainAvatar';
import { Emoji, EmojiPicker } from '@/lib/ui/components/Emoji';
import PermissionSetting from '@/lib/ui/components/settings/PermissionSetting';
import { SettingsModal, popUnsaved, pushUnsaved } from '@/lib/ui/components/settings/SettingsModal';

import config from '@/config';
import { AppState, SessionState } from '@/lib/contexts';
import { DomainWrapper, useAclEntries, useAclEntriesByRole, useApp, useCachedState, useDomain, useMemoState, useProfile, useSession } from '@/lib/hooks';
import { AclEntry, AllChannelPermissions, AllPermissions, ChannelGroup, ChannelTypes, Role } from '@/lib/types';
import { diff } from '@/lib/utility';


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
  session: SessionState;
  domain: DomainWrapper;
};


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
    </>
  );
}


////////////////////////////////////////////////////////////
const CHANNEL_GROUP_PERMISSION_COLUMNS = [
  {
    name: 'Name',
    grow: 1,
    style: { fontSize: 14 },
    selector: (group: ChannelGroup) => group.name,
  },
  {
    name: 'Can View',
    center: true,
    width: '6rem',
    cell: (group: { can_view: boolean }) => group.can_view ?
      (<Box sx={(theme) => ({ color: theme.colors.green[5] })}><IconCheck data-tag='allowRowEvents' size={20} /></Box>) :
      (<Box sx={(theme) => ({ color: theme.colors.red[5] })}><IconX data-tag='allowRowEvents' size={20} /></Box>),
  },
  {
    name: 'Can Manage',
    center: true,
    width: '8rem',
    cell: (group: { can_manage: boolean }) => group.can_manage ?
      (<Box sx={(theme) => ({ color: theme.colors.green[5] })}><IconCheck data-tag='allowRowEvents' size={20} /></Box>) :
      (<Box sx={(theme) => ({ color: theme.colors.red[5] })}><IconX data-tag='allowRowEvents' size={20} /></Box>),
  },
];

////////////////////////////////////////////////////////////
function GroupPermissoinsExpandableRows({ data, domain }: { data: ChannelGroup, domain: DomainWrapper }) {
  return (
    <Stack
      spacing={0}
      pt={6}
      sx={(theme) => ({ backgroundColor: theme.colors.dark[7] })}
    >
      {data.channels.map((channel_id, idx) => (
        <Group spacing='xs' p='0.3rem 0.6rem'>
          <ChannelIcon type={domain.channels[channel_id].type} size={16} />
          <Text inline size='sm' weight={600} mb={1} sx={{ flexGrow: 1 }}>
            {domain.channels[channel_id].name}
          </Text>
        </Group>
      ))}
    </Stack>
  );
}


////////////////////////////////////////////////////////////
type RoleFormValues = {
  roles: Role[];
  domain_permissions: Record<string, {
    can_manage: boolean;
    can_manage_invites: boolean;
    can_create_resources: boolean;
    can_manage_extensions: boolean;
    can_create_roles: boolean;
  }>;
};

////////////////////////////////////////////////////////////
type RoleSettingsTabsProps = {
  domain: DomainWrapper;
  role: Role;
  roleIdx: number;
  form: UseFormReturnType<RoleFormValues>;
};

////////////////////////////////////////////////////////////
function RoleSettingsTabs({ domain, role, roleIdx, form }: RoleSettingsTabsProps) {
  // Get permissions for this role
  const acl = useAclEntriesByRole(role.id);

  // The current tab that is open
  const [activeTab, setActiveTab] = useCachedState<string | null>(`settings.${domain.id}.roles.tab`, 'general');
  // Is badge picker open
  const [badgePickerOpen, setBadgePickerOpen] = useState<boolean>(false);

  // Data table
  const groupPermissionsData = useMemo(() => {
    if (!acl._exists) return [];

    // Map of resource id to acl entry
    const aclMap: Record<string, AclEntry> = {};
    for (const entry of acl.data)
      aclMap[entry.resource] = entry;

    // Create data
    return domain.groups.map(group => ({
      ...group,
      can_view: aclMap[group.id] ? aclMap[group.id].permissions.findIndex(x => x === 'can_view') >= 0 : false,
      can_manage: aclMap[group.id] ? aclMap[group.id].permissions.findIndex(x => x === 'can_manage') >= 0 : false,
    }))
  }, [domain.groups, acl.data]);


  return (
    <Tabs value={activeTab} onTabChange={setActiveTab} variant='outline' defaultValue='general'>
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
            description={<>Allows <b>{`@${role.label}`}</b> to manage domain settings, including the domain name, icon, and banner.</>}
            switchProps={form.getInputProps(`domain_permissions.${role.id}.can_manage`, { type: 'checkbox' })}
          />

          <PermissionSetting
            title='Manage Invites'
            description={<>Allows <b>{`@${role.label}`}</b> to create, edit, and delete invites to the domain.</>}
            switchProps={form.getInputProps(`domain_permissions.${role.id}.can_manage_invites`, { type: 'checkbox' })}
          />

          <PermissionSetting
            title='Manage Extensions'
            description={<>Allows <b>{`@${role.label}`}</b> to add and manage the extensions of this domain.</>}
            switchProps={form.getInputProps(`domain_permissions.${role.id}.can_manage_extensions`, { type: 'checkbox' })}
          />

          <PermissionSetting
            title='Create Roles'
            description={<>Allows <b>{`@${role.label}`}</b> to create and manage new roles within this domain, but does not allow them to edit or delete any existing role that they do not already have permissions for. Users will not be able to create new roles with permissions that they do not have. To enable more precise role management capabilities, assign <b>{`@${role.label}`}</b> as a "Manager" to the specific roles it should handle.</>}
            switchProps={form.getInputProps(`domain_permissions.${role.id}.can_create_roles`, { type: 'checkbox' })}
            withDivider={false}
          />

          <Divider maw={config.app.ui.settings_maw} mt={16} />
          <Box mb={12}>
            <Group spacing='xs' mb={4}>
              <ChannelIcon type='text' size={20} />
              <Title order={4}>Channel Permissions</Title>
            </Group>
            <Text size='sm' color='dimmed' maw={config.app.ui.settings_maw}>
              {/* TODO : Allow channels to be clickable (to modify channel permissions) */}
              Permissions for each channel group. Click a group to modify its permissions.
            </Text>
          </Box>

          <DataTable
            columns={CHANNEL_GROUP_PERMISSION_COLUMNS}
            data={groupPermissionsData}
            expandableRowsComponent={GroupPermissoinsExpandableRows}
            expandableRowsProps={{ domain }}
            onRowClicked={(row) => {
              // Save changes in cache
              pushUnsaved(domain.id, form.values);

              // Open modal
              openChannelGroupSettings({
                domain_id: domain.id,
                group: row,
                tab: 'permissions',
                role,
              });
            }}
            wrapperProps={{
              maw: config.app.ui.settings_maw,
            }}
          />
        </Stack>
      </Tabs.Panel>
    </Tabs>
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
    const domainPermissions: RoleFormValues['domain_permissions'] = {};

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
    } as RoleFormValues;
  }, [aclEntries.data, domain.roles]);
  const form = useForm({ initialValues });

  // Chosen role
  const [selectedRole, setSelectedRole] = useCachedState<Role | null>(`settings.${domain.id}.roles.selected`, null);

  // Reset form values on change
  useEffect(() => {
    const cached = popUnsaved(domain.id);

    if (cached) {
      form.setValues(cached);
    }
    else if (!form.isDirty()) {
      form.setValues(initialValues);
      form.resetDirty(initialValues);
    }
  }, [initialValues]);

  // Index of role
  const selectedIdx = useMemo(() => {
    if (!selectedRole) return null;
    return domain.roles.findIndex(x => x.id === selectedRole.id);
  }, [selectedRole, domain.roles]);


  return (
    <>
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
                  backgroundColor: selectedRole?.id === role.id ? theme.colors.dark[7] : undefined,
                  transition: 'background-color, 0.08s',

                  '&:hover': {
                    backgroundColor: theme.colors.dark[7],
                  },
                })}
                onClick={() => setSelectedRole(role)}
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

      {selectedRole && selectedIdx !== null && (
        <>
          <Divider sx={(theme) => ({ borderColor: theme.colors.dark[5] })} />
          <Title order={3} mb={8}>Edit - {'@'}{selectedRole.label}</Title>

          <RoleSettingsTabs
            domain={domain}
            role={selectedRole}
            roleIdx={selectedIdx}
            form={form}
          />
        </>
      )}

      <SettingsModal.Unsaved
        form={form}
        initialValues={initialValues}
        onSave={async () => {
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
  const session = useSession();
  const domain = useDomain(props.domain_id);

  // Tabs
  const tabs = useMemo(() => ({
    [domain.name || '_']: [
      { value: 'general', label: 'General' },
      { value: 'roles', label: 'Roles' },
    ],
  }), [domain.name]);


  if (!domain._exists) return null;
  const tabProps = { session, domain };

  return (
    <SettingsModal
      navkey={props.domain_id}
      tabs={tabs}
      defaultTab={props.tab}
      close={() => context.closeModal(id)}
    >
      <SettingsModal.Panel value='general'>
        <GeneralTab {...tabProps} />
      </SettingsModal.Panel>
      <SettingsModal.Panel value='roles'>
        <RolesTab {...tabProps} />
      </SettingsModal.Panel>
    </SettingsModal>
  );
}