import { PropsWithChildren, RefObject, forwardRef, useEffect, useMemo, useRef, useState } from 'react';

import {
  ActionIcon,
  Box,
  Button,
  Center,
  CloseButton,
  ColorSwatch,
  Divider,
  Flex,
  Group,
  Popover,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
  useMantineTheme
} from '@mantine/core';
import { ContextModalProps, openConfirmModal } from '@mantine/modals';

import { IconAt, IconBadgeOff, IconFolder, IconPlus, IconTrash } from '@tabler/icons-react';

import ActionButton from '@/lib/ui/components/ActionButton';
import ChannelIcon from '@/lib/ui/components/ChannelIcon';
import DataTable from '@/lib/ui/components/DataTable';
import { Emoji } from '@/lib/ui/components/Emoji';
import ProfileAvatar from '@/lib/ui/components/ProfileAvatar';
import PermissionSetting from '@/lib/ui/components/settings/PermissionSetting';
import { SettingsModal } from '@/lib/ui/components/settings/SettingsModal';

import config from '@/config';
import { AppState, SessionState } from '@/lib/contexts';
import { DomainWrapper, ProfileWrapper, canSetPermissions, hasPermission, useAclEntries, useApp, useCachedState, useDomain, useMemoState, useProfile, useSession } from '@/lib/hooks';
import { AllPermissions, ChannelGroup, Role } from '@/lib/types';
import { useForm } from '@mantine/form';
import { diff } from '@/lib/utility';


////////////////////////////////////////////////////////////
type TabProps = {
  session: SessionState;
  domain: DomainWrapper;
  group: ChannelGroup;
};


////////////////////////////////////////////////////////////
type PermissionSet = {
  can_view: boolean;
  can_manage: boolean;
  can_delete_group: boolean,
  can_manage_resources: boolean;
  can_send_messages: boolean;
  can_send_attachments: boolean;
  can_delete_messages: boolean;
  can_broadcast_audio: boolean;
  can_broadcast_video: boolean;
  can_manage_participants: boolean;
  can_manage_tasks: boolean;
  can_manage_own_tasks: boolean;
};

////////////////////////////////////////////////////////////
type PermissionsFormValues = {
  /** Map of role id to their permissions */
  permissions: Record<string, PermissionSet>;
};

////////////////////////////////////////////////////////////
const DEFAULT_PERMISSION_SET = {
  can_view: true,
  can_manage: false,
  can_delete_group: false,
  can_manage_resources: false,
  can_send_messages: true,
  can_send_attachments: true,
  can_delete_messages: false,
  can_broadcast_audio: true,
  can_broadcast_video: true,
  can_manage_participants: false,
  can_manage_tasks: false,
  can_manage_own_tasks: false,
} as PermissionSet;


////////////////////////////////////////////////////////////
const RoleSelectItem = forwardRef<HTMLDivElement, { label: string; badge: string }>(
  ({ label, badge, ...others }, ref) => (
    <div ref={ref} {...others}>
      <Group spacing='xs' noWrap>
        <Box h='1.5rem' pt={2} sx={(theme) => ({ color: theme.colors.dark[3] })}>
          {badge ? (<Emoji id={badge} size='1rem' />) : (<IconBadgeOff size={19} />)}
        </Box>
        <Text size='sm'>{label}</Text>
      </Group>
    </div>
  )
);
RoleSelectItem.displayName = 'RoleSelectItem';

////////////////////////////////////////////////////////////
function AddRolePopover(props: { domain: DomainWrapper; onSelect: (role_id: string) => void; data: Role[]; type: 'empty' | 'table' }) {
  const [opened, setOpened] = useState<boolean>(false);

  const roles = useMemo(
    () => props.data.map(x => ({ value: x.id, label: x.label, badge: x.badge })),
    [props.domain.roles, props.data]
  );


  return (
    <Popover
      opened={opened}
      position='bottom'
      withArrow
      onClose={() => setOpened(false)}
    >
      {roles.length > 0 && props.type === 'table' && (
        <Popover.Target>
          <ActionIcon onClick={() => setOpened(!opened)}>
            <IconPlus size={19} />
          </ActionIcon>
        </Popover.Target>
      )}
      {roles.length > 0 && props.type === 'empty' && (
        <Popover.Target>
          <Button
            variant='default'
            leftIcon={<IconPlus size={18} />}
            onClick={() => setOpened(!opened)}
          >
            Add Permissions
          </Button>
        </Popover.Target>
      )}

      <Popover.Dropdown onKeyDown={(e) => { e.stopPropagation() }}>
        <Select
          placeholder='Choose a role'
          data={roles}
          icon={<IconAt size={16} />}
          itemComponent={RoleSelectItem}
          searchable
          onChange={(value) => {
            if (!value) return;
            props.onSelect(value);
            // Close after select
            setOpened(false);
          }}
        />
      </Popover.Dropdown>
    </Popover>
  );
}

////////////////////////////////////////////////////////////
function PermissionsTab({ domain, group, ...props }: TabProps & { role?: Role }) {
  const theme = useMantineTheme();

  // WIP : Implement delete group acl entry from group permissions settings, delete group acl entry from domain settings

  // Group permissions
  const aclEntries = useAclEntries(group.id);

  // Indicates if the props role was deleted
  const [propsRoleDeleted, setPropsRoleDeleted] = useState<boolean>(false);


  // Settings form
  const initialValues = useMemo(() => {
    if (!aclEntries._exists) return { permissions: {} };

    function hasPerm(list: AllPermissions[] | undefined, permission: AllPermissions) {
      return list ? list.findIndex(x => x === permission) >= 0 : false;
    }

    // Map of group permissions per role
    const permissions: PermissionsFormValues['permissions'] = {};

    // Filter out roles that don't exist on domain
    const domainRoles = new Set<string>(domain.roles.map(x => x.id));

    // Add extra temp role if needed
    const data = aclEntries.data.filter(e => domainRoles.has(e.role));
    if (props.role && aclEntries.data.findIndex(x => x.role === props.role?.id) < 0) {
      data.push({
        id: '',
        domain: domain.id,
        resource: group.id,
        role: props.role.id,
        permissions: [],
      });
    }
    
    for (const entry of data) {
      permissions[entry.role] = {
        can_view: hasPerm(entry?.permissions, 'can_view'),
        can_manage: hasPerm(entry?.permissions, 'can_manage'),
        can_delete_group: hasPerm(entry?.permissions, 'can_delete_group'),
        can_manage_resources: hasPerm(entry?.permissions, 'can_manage_resources'),
        can_send_messages: hasPerm(entry?.permissions, 'can_send_messages'),
        can_send_attachments: hasPerm(entry?.permissions, 'can_send_attachments'),
        can_delete_messages: hasPerm(entry?.permissions, 'can_delete_messages'),
        can_broadcast_audio: hasPerm(entry?.permissions, 'can_broadcast_audio'),
        can_broadcast_video: hasPerm(entry?.permissions, 'can_broadcast_video'),
        can_manage_participants: hasPerm(entry?.permissions, 'can_manage_participants'),
        can_manage_tasks: hasPerm(entry?.permissions, 'can_manage_tasks'),
        can_manage_own_tasks: hasPerm(entry?.permissions, 'can_manage_own_tasks'),
      };
    }

    // Form values
    return {
      permissions
    } as PermissionsFormValues;
  }, [aclEntries.data, props.role]);
  const form = useForm({ initialValues });

  // Currently selected role
  const [selectedRoleId, setSelectedRoleId] = useCachedState<string | null>(`settings.${group.id}.roles.selected`, null, props.role?.id);
  const selectedRole = useMemo(() => domain.roles.find(x => x.id === selectedRoleId) || null, [domain.roles, selectedRoleId]);

  // Get roles that have acl entries for this group
  const roles = useMemo(() => {
    if (!aclEntries._exists) return [];

    const entries = aclEntries.data.slice();
    const canManageResource = hasPermission(domain, group.id, 'can_manage');

    // Check which entries can be deleted
    const canDelete = aclEntries.data.map(entry => {
      let canDelete = canSetPermissions(domain, entry);
      for (const perm of entry.permissions)
        canDelete = canDelete && hasPermission(domain, group.id, perm);
      return canDelete;
    });

    // Add any missing from form
    for (const [roleId, perms] of Object.entries(form.values.permissions)) {
      if (entries.findIndex(x => x.role === roleId) < 0) {
        entries.push({
          id: '',
          domain: domain.id,
          resource: group.id,
          role: roleId,
          permissions: Object.entries(perms).filter(([k, v]) => v).map(([k, v]) => k) as AllPermissions[],
        });
        canDelete.push(true);
      }
    }

    // Construct roles array
    const roles: (Role & { can_delete: boolean })[] = [];
    for (let i = 0; i < entries.length; ++i) {
      const entry = entries[i];
      if (!form.values.permissions[entry.role]) continue;
      if (!canManageResource && !hasPermission(domain, entry.role, 'can_manage')) continue;

      const role = domain.roles.find(x => x.id === entry.role);
      if (!role) continue;

      roles.push({ ...role, can_delete: canDelete[i] });
    }

    return roles;
  }, [form.values.permissions, domain.roles, domain._permissions]);
  
  // Roles that can be added
  const addableRoles = useMemo(
    () => domain.roles.filter(x => canSetPermissions(domain, { role: x.id, resource: group.id }) && roles.findIndex(r => r.id === x.id) < 0),
    [roles, domain.roles, domain._permissions]
  );

  // Table columns
  const columns = useMemo(() => ([
    {
      name: 'Role',
      grow: 1,
      cell: (role: Role) => (
        <Group spacing='xs'>
          <Box h='1.5rem' pt={2} sx={(theme) => ({ color: theme.colors.dark[3] })}>
            {role.badge ? (<Emoji id={role.badge} size='1rem' />) : (<IconBadgeOff size={19} />)}
          </Box>
          <Text inline size='sm' weight={600}>
            {role.label}
          </Text>
        </Group>
      ),
    },
    {
      name: (
        <AddRolePopover
          domain={domain}
          type='table'
          data={addableRoles}
          onSelect={(role_id) => {
            // Add new default permission set
            form.setFieldValue('permissions', {
              ...form.values.permissions,
              [role_id]: DEFAULT_PERMISSION_SET,
            });

            // Set new role as selected
            setSelectedRoleId(role_id || null);
          }}
        />
      ),
      width: '4rem',
      right: true,
      cell: (role: Role & { can_delete: boolean }) => role.can_delete ? (
        <CloseButton
          size='md'
          iconSize={18}
          onClick={() => {
            const copy = { ...form.values.permissions };
            delete copy[role.id];

            // Add to form value
            form.setFieldValue('permissions', copy);

            // Switch off of it if it is selected
            if (role.id === selectedRoleId)
              setSelectedRoleId(null);
            if (role.id === props.role?.id)
              setPropsRoleDeleted(true);
          }}
        />
      ) : null,
    },
  ]), [domain, form.values.permissions, selectedRoleId]);

  // Reset form values on change
  useEffect(() => {
    if (!form.isDirty()) {
      form.setValues(initialValues);
      form.resetDirty(initialValues);
    }
  }, [initialValues]);
  
  // Map of which permissions able to set
  const _perms = useMemo(() => {
    const entry = aclEntries.data?.find(x => x.role === selectedRoleId) || {
      id: '', domain: '',
      role: selectedRoleId || '',
      resource: group.id,
      permissions: [],
    };

    const canSet = canSetPermissions(domain, entry);
    return {
      can_set: canSet,
      can_view: canSet && hasPermission(domain, group.id, 'can_view'),
      can_manage: canSet && hasPermission(domain, group.id, 'can_manage'),
      can_delete_group: canSet && hasPermission(domain, group.id, 'can_delete_group'),
      can_manage_resources: canSet && hasPermission(domain, group.id, 'can_manage_resources'),
      can_send_messages: canSet && hasPermission(domain, group.id, 'can_send_messages'),
      can_send_attachments: canSet && hasPermission(domain, group.id, 'can_send_attachments'),
      can_delete_messages: canSet && hasPermission(domain, group.id, 'can_delete_messages'),
      can_broadcast_audio: canSet && hasPermission(domain, group.id, 'can_broadcast_audio'),
      can_broadcast_video: canSet && hasPermission(domain, group.id, 'can_broadcast_video'),
      can_manage_participants: canSet && hasPermission(domain, group.id, 'can_manage_participants'),
      can_manage_tasks: canSet && hasPermission(domain, group.id, 'can_manage_tasks'),
      can_manage_own_tasks: canSet && hasPermission(domain, group.id, 'can_manage_own_tasks'),
    };
  }, [aclEntries.data, selectedRoleId]);


  return (
    <>
      <Box>
        <Title order={3}>Roles</Title>
        <Text size='sm' color='dimmed' maw={config.app.ui.settings_maw}>
          Customize the permissions each role has for this channel group.
          Users can only modify permissions for actions that they themselves can perform.
          To prevent users from locking themselves out of being able to modify a permission,
          it is recommended to give roles every permission they should handle, even
          if that permission has been granted to <b>@everyone</b>.
        </Text>
      </Box>

      <DataTable
        columns={columns}
        data={roles}
        onRowClicked={(role) => setSelectedRoleId(role.id)}
        wrapperProps={{
          maw: config.app.ui.settings_maw,
        }}
        emptyComponent={(
          <Stack align='center'>
            <Text weight={600}>This channel group has no permission sets</Text>
            <AddRolePopover
              domain={domain}
              type='empty'
              data={addableRoles}
              onSelect={(role_id) => {
                // Add new default permission set
                form.setFieldValue('permissions', {
                  ...form.values.permissions,
                  [role_id]: DEFAULT_PERMISSION_SET,
                });

                // Set new role as selected
                setSelectedRoleId(role_id || null);
              }}
            />
          </Stack>
        )}
        rowStyles={[
          {
            when: (row) => row.id === selectedRoleId,
            style: { backgroundColor: theme.colors.dark[6] },
          }
        ]}
      />

      {selectedRole && (
        <>
          <Divider sx={(theme) => ({ borderColor: theme.colors.dark[5] })} />

          <Box mb={12}>
            <Group spacing='xs' mb={4}>
              <IconFolder type='text' size={20} />
              <Title order={4}>General Permissions</Title>
            </Group>
            <Text size='sm' color='dimmed' maw={config.app.ui.settings_maw}>
              General permissions for channels and resources in this group.
            </Text>
          </Box>

          <PermissionSetting
            title='View Group'
            description={<>Allows <b>{`@${selectedRole.label}`}</b> to view this group and the channels and resources within this group.</>}
            switchProps={form.getInputProps(`permissions.${selectedRoleId}.can_view`, { type: 'checkbox' })}
            disabled={!_perms.can_view}
          />

          <PermissionSetting
            title='Manage Group'
            description={<>
              Allows <b>{`@${selectedRole.label}`}</b> to manage group settings, edit settings for existing channels within the group, and manage role access and permissions.
            </>}
            switchProps={form.getInputProps(`permissions.${selectedRoleId}.can_manage`, { type: 'checkbox' })}
            disabled={!_perms.can_manage}
          />

          <PermissionSetting
            title='Delete Group'
            description={<>Allows <b>{`@${selectedRole.label}`}</b> to delete this group.</>}
            switchProps={form.getInputProps(`permissions.${selectedRoleId}.can_delete_group`, { type: 'checkbox' })}
            disabled={!_perms.can_delete_group}
          />

          <PermissionSetting
            title='Manage Channels'
            description={<>Allows <b>{`@${selectedRole.label}`}</b> to create, edit, and delete channels within this group.</>}
            switchProps={form.getInputProps(`permissions.${selectedRoleId}.can_manage_resources`, { type: 'checkbox' })}
            disabled={!_perms.can_manage_resources}
            withDivider={false}
          />

          <Divider maw={config.app.ui.settings_maw} mt={16} />
          <Box mb={12}>
            <Group spacing='xs' mb={4}>
              <ChannelIcon type='text' size={20} />
              <Title order={4}>Chat Permissions</Title>
            </Group>
            <Text size='sm' color='dimmed' maw={config.app.ui.settings_maw}>
              Permissions for text channels in this group.
            </Text>
          </Box>

          <PermissionSetting
            title='Send Messages'
            description={<>Allows <b>{`@${selectedRole.label}`}</b> to send messages in text channels.</>}
            switchProps={form.getInputProps(`permissions.${selectedRoleId}.can_send_messages`, { type: 'checkbox' })}
            disabled={!_perms.can_send_messages}
          />

          <PermissionSetting
            title='Send Attachments'
            description={<>Allows <b>{`@${selectedRole.label}`}</b> to send file attachments in text channels.</>}
            switchProps={form.getInputProps(`permissions.${selectedRoleId}.can_send_attachments`, { type: 'checkbox' })}
            disabled={!_perms.can_send_attachments}
          />

          <PermissionSetting
            title='Delete Messages'
            description={<>Allows <b>{`@${selectedRole.label}`}</b> to delete messages sent by other users in text channels.</>}
            switchProps={form.getInputProps(`permissions.${selectedRoleId}.can_delete_messages`, { type: 'checkbox' })}
            disabled={!_perms.can_delete_messages}
            withDivider={false}
          />

          <Divider maw={config.app.ui.settings_maw} mt={16} />
          <Box mb={12}>
            <Group spacing='xs' mb={4}>
              <ChannelIcon type='rtc' size={20} />
              <Title order={4}>Voice & Video Permissions</Title>
            </Group>
            <Text size='sm' color='dimmed' maw={config.app.ui.settings_maw}>
              Permissions for voice & video channels in this group. Voice & video channels will be referred to as RTC channels.
            </Text>
          </Box>

          <PermissionSetting
            title='Broadcast Audio'
            description={<>Allows <b>{`@${selectedRole.label}`}</b> to broadcast audio using their microphone in RTC channels.</>}
            switchProps={form.getInputProps(`permissions.${selectedRoleId}.can_broadcast_audio`, { type: 'checkbox' })}
            disabled={!_perms.can_broadcast_audio}
          />

          <PermissionSetting
            title='Broadcast Video'
            description={<>Allows <b>{`@${selectedRole.label}`}</b> to broadcast video using their webcam or screenshare in RTC channels.</>}
            switchProps={form.getInputProps(`permissions.${selectedRoleId}.can_broadcast_video`, { type: 'checkbox' })}
            disabled={!_perms.can_broadcast_video}
          />

          <PermissionSetting
            title='Manage Participants'
            description={<>Allows <b>{`@${selectedRole.label}`}</b> to manage other participants in RTC channels. Users with this permission are able to mute, deafen, force-stop video broadcasts, move, kick, or ban other participants within an RTC channel.</>}
            switchProps={form.getInputProps(`permissions.${selectedRoleId}.can_manage_participants`, { type: 'checkbox' })}
            disabled={!_perms.can_manage_participants}
            withDivider={false}
          />

          <Divider maw={config.app.ui.settings_maw} mt={16} />
          <Box mb={12}>
            <Group spacing='xs' mb={4}>
              <ChannelIcon type='board' size={19} />
              <Title order={4}>Board Permissions</Title>
            </Group>
            <Text size='sm' color='dimmed' maw={config.app.ui.settings_maw}>
              Permissions for task boards in this group.
            </Text>
          </Box>

          <PermissionSetting
            title='Manage Tasks'
            description={<>Allows <b>{`@${selectedRole.label}`}</b> to create, edit, and delete any task within a board, regardless of assignee.</>}
            switchProps={form.getInputProps(`permissions.${selectedRoleId}.can_manage_tasks`, { type: 'checkbox' })}
            disabled={!_perms.can_manage_tasks}
          />

          <PermissionSetting
            title='Manage Own Tasks'
            description={<>Allows <b>{`@${selectedRole.label}`}</b> to create, edit, and delete their own tasks within a board.</>}
            switchProps={form.getInputProps(`permissions.${selectedRoleId}.can_manage_own_tasks`, { type: 'checkbox' })}
            disabled={!_perms.can_manage_own_tasks}
            withDivider={false}
          />
        </>
      )}

      <SettingsModal.Unsaved
        form={form}
        initialValues={initialValues}
        onReset={(initialValues) => {
          // Go to empty role if current role does not exist after reset
          if (selectedRoleId && !initialValues.permissions[selectedRoleId])
            setSelectedRoleId(null);
        }}
        onSave={async () => {
          // Set permissions if changed
          const diffs = diff(initialValues.permissions, form.values.permissions);

          if (aclEntries._exists && diffs && Object.keys(diffs).length > 0) {
            // Get permissions list for each one that changed
            const permChanges: Record<string, AllPermissions[]> = {};
            for (const role_id of Object.keys(diffs || {}))
              permChanges[role_id] = Object.entries(form.values.permissions[role_id] || {}).filter(([k, v]) => v).map(x => x[0]).sort() as AllPermissions[];

            // Mutation
            await aclEntries._mutators.setPermissions(permChanges);
          }
        }}
      />
    </>
  );
}


////////////////////////////////////////////////////////////
export type ChannelGroupSettingsProps = {
  /** The id of the domain of the channel group */
  domain_id: string;
  /** The channel group to show settings for */
  group: ChannelGroup;
  /** The starting tab */
  tab?: string;
  /** The starting role for the "Permissions" tab */
  role?: Role;
};

////////////////////////////////////////////////////////////
export default function ChannelGroupSettings({ context, id, innerProps: props }: ContextModalProps<ChannelGroupSettingsProps>) {
  const session = useSession();
  const domain = useDomain(props.domain_id);

  // Tabs
  const tabs = useMemo(() => ({
    [`${domain.name} / ${props.group.name}`]: [
      { value: 'permissions', label: 'Permissions' },
    ],
  }), [domain.name, props.group.name]);


  if (!domain._exists) return null;
  const tabProps = { session, domain, group: props.group };

  return (
    <SettingsModal
      navkey={props.group.id}
      tabs={tabs}
      defaultTab={props.tab}
      close={() => context.closeModal(id)}
    >
      <SettingsModal.Panel value='permissions'>
        <PermissionsTab {...tabProps} role={props.role} />
      </SettingsModal.Panel>
    </SettingsModal>
  );
}