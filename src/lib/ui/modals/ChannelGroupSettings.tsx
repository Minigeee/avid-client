import { RefObject, forwardRef, useEffect, useMemo, useRef, useState } from 'react';

import {
  Box,
  Button,
  Center,
  CloseButton,
  ColorSwatch,
  Divider,
  Flex,
  Group,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  useMantineTheme
} from '@mantine/core';
import { ContextModalProps, openConfirmModal } from '@mantine/modals';

import { IconBadgeOff, IconFolder, IconTrash } from '@tabler/icons-react';

import ActionButton from '@/lib/ui/components/ActionButton';
import ChannelIcon from '@/lib/ui/components/ChannelIcon';
import DataTable from '@/lib/ui/components/DataTable';
import { Emoji } from '@/lib/ui/components/Emoji';
import ProfileAvatar from '@/lib/ui/components/ProfileAvatar';
import PermissionSetting from '@/lib/ui/components/settings/PermissionSetting';
import UnsavedChanges from '@/lib/ui/components/settings/UnsavedChanges';
import SettingsMenu from '@/lib/ui/components/settings/SettingsMenu';

import config from '@/config';
import { AppState, SessionState } from '@/lib/contexts';
import { DomainWrapper, ProfileWrapper, useAclEntries, useApp, useCachedState, useDomain, useMemoState, useProfile, useSession } from '@/lib/hooks';
import { AllPermissions, ChannelGroup, Role } from '@/lib/types';
import { useForm } from '@mantine/form';
import { diff } from '@/lib/utility';


////////////////////////////////////////////////////////////
const TABS = {
  '_': [
    { value: 'permissions', label: 'Permissions' },
  ],
};
let FLATTENED: { value: string; label: string }[] = [];
for (const tabs of Object.values(TABS))
  FLATTENED = FLATTENED.concat(tabs);

////////////////////////////////////////////////////////////
type TabProps = {
  app: AppState;
  session: SessionState;
  domain: DomainWrapper;
  group: ChannelGroup;

  /** Modal body ref */
  bodyRef: RefObject<HTMLDivElement>;
};


////////////////////////////////////////////////////////////
const PERMISSIONS_ROLE_COLUMNS = [
  {
    name: 'Role',
    grow: 1,
    cell: (role: Role) => (
      <Group spacing='xs'>
        <Box h='1.5rem' pt={2} sx={(theme) => ({ color: theme.colors.dark[3] })}>
          {role.badge ? (<Emoji id={role.badge} size='1rem' />) : (<IconBadgeOff size={19} />)}
        </Box>
        <Text inline size='sm' weight={600} sx={{ flexGrow: 1 }}>
          {role.label}
        </Text>
        {role.color && <ColorSwatch color={role.color} size='1.0rem' />}
      </Group>
    ),
  },
];

////////////////////////////////////////////////////////////
type PermissionsFormValues = {
  /** Map of role id to their permissions */
  permissions: Record<string, {
    can_view: boolean;
    can_manage: boolean;
    can_create_resources: boolean;
    can_send_messages: boolean;
    can_send_attachments: boolean;
    can_delete_messages: boolean;
    can_broadcast_audio: boolean;
    can_broadcast_video: boolean;
    can_manage_participants: boolean;
    can_manage_tasks: boolean;
    can_manage_own_tasks: boolean;
  }>;
};

////////////////////////////////////////////////////////////
function PermissionsTab({ group, ...props }: TabProps & { role?: Role }) {
  const theme = useMantineTheme();

  // Group permissions
  const aclEntries = useAclEntries(group.id);
  
  // Settings form
  const initialValues = useMemo(() => {
    if (!aclEntries._exists) return { permissions: {} };

    function hasPerm(list: AllPermissions[] | undefined, permission: AllPermissions) {
      return list ? list.findIndex(x => x === permission) >= 0 : false;
    }

    // Map of group permissions per role
    const permissions: PermissionsFormValues['permissions'] = {};

    for (const entry of aclEntries.data) {
      permissions[entry.role] = {
        can_view: hasPerm(entry?.permissions, 'can_view'),
        can_manage: hasPerm(entry?.permissions, 'can_manage'),
        can_create_resources: hasPerm(entry?.permissions, 'can_create_resources'),
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
  }, [aclEntries.data]);
  const form = useForm({ initialValues });

  // Currently selected role
  const [selectedRole, setSelectedRole] = useCachedState<Role | null>(`settings.${group.id}.roles.selected`, null, props.role);

  // Get roles that have acl entries for this group
  const roles = useMemo(() => {
    if (!aclEntries._exists) return [];
    return aclEntries.data.map(e => props.domain.roles.find(x => x.id === e.role)).filter(x => x) as Role[];
  }, [aclEntries.data, props.domain.roles]);
  
  // Reset form values on change
  useEffect(() => {
    if (!form.isDirty()) {
      form.setValues(initialValues);
      form.resetDirty(initialValues);
    }
  }, [initialValues]);


  return (
    <>
    <Stack pb='5rem'>
      <Box>
        <Title order={3}>Roles</Title>
        <Text size='sm' color='dimmed'>
          Customize the permissions each role has for this channel group.
        </Text>
      </Box>

      <DataTable
        columns={PERMISSIONS_ROLE_COLUMNS}
        data={roles}
        onRowClicked={setSelectedRole}
        wrapperProps={{
          maw: config.app.ui.settings_maw,
        }}
        rowStyles={[
          {
            when: (row) => row.id === selectedRole?.id,
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
            description='Allows users with this role to view this group and the channels and resources within this group.'
            switchProps={form.getInputProps(`permissions.${selectedRole.id}.can_view`, { type: 'checkbox' })}
          />

          <PermissionSetting
            title='Manage Group'
            description='Allows users with this role to manage group settings, edit and delete channels within the group, and manage role access and permissions. This role will only be able to manage permissions for roles which they can already manage.'
            switchProps={form.getInputProps(`permissions.${selectedRole.id}.can_manage`, { type: 'checkbox' })}
          />

          <PermissionSetting
            title='Create Channels'
            description='Allows users with this role to create any new channels and resources within this group, but does not allow them to edit or delete the channels.'
            switchProps={form.getInputProps(`permissions.${selectedRole.id}.can_create_resources`, { type: 'checkbox' })}
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
            description='Allows users with this role to send messages in text channels.'
            switchProps={form.getInputProps(`permissions.${selectedRole.id}.can_send_messages`, { type: 'checkbox' })}
          />

          <PermissionSetting
            title='Send Attachments'
            description='Allows users with this role to send file attachments in text channels.'
            switchProps={form.getInputProps(`permissions.${selectedRole.id}.can_send_attachments`, { type: 'checkbox' })}
          />

          <PermissionSetting
            title='Delete Messages'
            description='Allows users with this role to delete messages sent by other users in text channels.'
            switchProps={form.getInputProps(`permissions.${selectedRole.id}.can_delete_messages`, { type: 'checkbox' })}
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
            description='Allows users with this role to broadcast audio using their microphone in RTC channels.'
            switchProps={form.getInputProps(`permissions.${selectedRole.id}.can_broadcast_audio`, { type: 'checkbox' })}
          />

          <PermissionSetting
            title='Broadcast Video'
            description='Allows users with this role to broadcast video using their webcam or screenshare in RTC channels.'
            switchProps={form.getInputProps(`permissions.${selectedRole.id}.can_broadcast_video`, { type: 'checkbox' })}
          />

          <PermissionSetting
            title='Manage Participants'
            description='Allows users with this role to manage other participants in RTC channels. Users with this permission are able to mute, deafen, force-stop video broadcasts, move, kick, or ban other participants within an RTC channel.'
            switchProps={form.getInputProps(`permissions.${selectedRole.id}.can_manage_participants`, { type: 'checkbox' })}
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
            description='Allows users with this role to create, edit, and delete any task within a board, regardless of assignee.'
            switchProps={form.getInputProps(`permissions.${selectedRole.id}.can_manage_tasks`, { type: 'checkbox' })}
          />

          <PermissionSetting
            title='Manage Own Tasks'
            description='Allows users with this role to create, edit, and delete their own tasks within a board.'
            switchProps={form.getInputProps(`permissions.${selectedRole.id}.can_manage_own_tasks`, { type: 'checkbox' })}
            withDivider={false}
          />
        </>
      )}
      </Stack>

      <UnsavedChanges
        bodyRef={props.bodyRef}
        form={form}
        initialValues={initialValues}
        onSubmit={async () => {
          // Set permissions if changed
          const diffs = diff(initialValues.permissions, form.values.permissions);

          if (aclEntries._exists && diffs && Object.keys(diffs).length > 0) {
            // Get permissions list for each one that changed
            const permChanges: Record<string, AllPermissions[]> = {};
            for (const role_id of Object.keys(diffs || {}))
              permChanges[role_id] = Object.entries(form.values.permissions[role_id]).filter(([k, v]) => v).map(x => x[0]).sort() as AllPermissions[];

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
  const app = useApp();
  const session = useSession();
  const domain = useDomain(props.domain_id);

  // Modal body
  const bodyRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useMemoState(() => {
    const tabId = props.tab || 'permissions';
    return FLATTENED.find(x => x.value === tabId);
  }, [props.tab]);


  if (!domain._exists) return null;
  const tabProps = { app, session, domain, group: props.group, bodyRef };

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
        groupNames={{ '_': props.group.name }}
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
          {tab?.value === 'permissions' && (<PermissionsTab {...tabProps} role={props.role} />)}
        </ScrollArea>
      </Flex>
    </Flex>
  );
}