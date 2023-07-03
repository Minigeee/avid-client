import { ReactNode, RefObject, forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ActionIcon,
  Box,
  Button,
  Center,
  CloseButton,
  ColorInput,
  ColorSwatch,
  DEFAULT_THEME,
  Divider,
  Group,
  Menu,
  Popover,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
  useMantineTheme
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { UseFormReturnType } from '@mantine/form/lib/types';

import {
  IconAt,
  IconBadgeOff,
  IconBuildingCommunity,
  IconCheck,
  IconDotsVertical,
  IconFolder,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUser,
  IconX,
} from '@tabler/icons-react';

import { openChannelGroupSettings } from '@/lib/ui/modals';
import ActionButton from '@/lib/ui/components/ActionButton';
import ChannelIcon from '@/lib/ui/components/ChannelIcon';
import DataTable from '@/lib/ui/components/DataTable';
import { Emoji, EmojiPicker } from '@/lib/ui/components/Emoji';
import MemberAvatar from '@/lib/ui/components/MemberAvatar';
import { MultiMemberInput } from '@/lib/ui/components/MemberInput';
import PermissionSetting from '@/lib/ui/components/settings/PermissionSetting';
import PortalAwareItem from '@/lib/ui/components/PortalAwareItem';
import { SettingsModal, popUnsaved, pushUnsaved } from '@/lib/ui/components/settings/SettingsModal';

import config from '@/config';
import { AppState, SessionState } from '@/lib/contexts';
import { DomainWrapper, MemberListWrapper, setPermissions, useAclEntries, useAclEntriesByRole, useCachedState, useMemberQuery } from '@/lib/hooks';
import { AclEntry, AllChannelPermissions, AllPermissions, ChannelGroup, ChannelTypes, ExpandedMember, Role } from '@/lib/types';
import { diff } from '@/lib/utility';
import { TableColumn } from 'react-data-table-component';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';

import { v4 as uuid } from 'uuid';
import { merge } from 'lodash';
import { useConfirmModal } from '@/lib/ui/modals/ConfirmModal';
import { useDebouncedValue } from '@mantine/hooks';


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
function _hasPerm(list: AllPermissions[] | undefined, permission: AllPermissions) {
  return list ? list.findIndex(x => x === permission) >= 0 : false;
}

////////////////////////////////////////////////////////////
function GroupPermissoinsExpandableRows({ data, domain }: { data: ChannelGroup, domain: DomainWrapper }) {
  return (
    <Stack
      spacing={0}
      pt={6}
      pb={6}
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
function AddGroupOverrideDropdown(props: { domain: DomainWrapper; role: Role; exclude?: ChannelGroup[] }) {
  const groups = useMemo(
    () => props.domain.groups.filter(
      x => !props.exclude || props.exclude.findIndex(y => y.id === x.id) < 0
    ).map(
      x => ({ value: x.id, label: x.name })
    ),
    [props.domain.groups, props.exclude]
  );

  return (
    <Popover.Dropdown>
      <Select
        placeholder='Choose a channel group'
        data={groups}
        icon={<IconFolder size={16} />}
        searchable
        onChange={(value) => openChannelGroupSettings({
          domain_id: props.domain.id,
          group: props.domain.groups.find(x => x.id === value) as ChannelGroup,
          tab: 'permissions',
          role: props.role,
        })}
      />
    </Popover.Dropdown>
  );
}

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
function AddRolePopover(props: { form: UseFormReturnType<RoleFormValues>; onSelect: (role_id: string) => void; exclude?: string[]; type: 'empty' | 'table' }) {
  const [opened, setOpened] = useState<boolean>(false);

  const roles = useMemo(
    () => props.form.values.roles.filter(
      x => !props.exclude || props.exclude.findIndex(y => y === x.id) < 0
    ).map(
      x => ({ value: x.id, label: x.label, badge: x.badge })
    ),
    [props.form.values.roles, props.exclude]
  );

  return (
    <Popover
      opened={opened}
      position='top'
      withArrow
      onClose={() => setOpened(false)}
    >
      {props.type === 'table' && (
        <Popover.Target>
          <ActionIcon onClick={() => setOpened(!opened)}>
            <IconPlus size={19} />
          </ActionIcon>
        </Popover.Target>
      )}
      {props.type === 'empty' && (
        <Popover.Target>
          <Button
            variant='default'
            leftIcon={<IconPlus size={18} />}
            onClick={() => setOpened(!opened)}
          >
            Add Manager
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
function AddMemberPopover(props: { domain_id: string; role_id: string; members: MemberListWrapper; exclude?: string[]; type: 'empty' | 'table' }) {
  const [opened, setOpened] = useState<boolean>(false);
  const [values, setValues] = useState<ExpandedMember[]>([]);

  return (
    <Popover
      opened={opened}
      position='top'
      withArrow
      onClose={() => setOpened(false)}
    >
      {props.type === 'table' && (
        <Popover.Target>
          <ActionIcon onClick={() => setOpened(!opened)}>
            <IconPlus size={19} />
          </ActionIcon>
        </Popover.Target>
      )}
      {props.type === 'empty' && (
        <Popover.Target>
          <Button
            variant='default'
            leftIcon={<IconPlus size={18} />}
            onClick={() => setOpened(!opened)}
          >
            Add Members
          </Button>
        </Popover.Target>
      )}

      <Popover.Dropdown>
        <Stack>
          <MultiMemberInput
            domain_id={props.domain_id}
            value={values}
            onChange={setValues}
            exclude={props.exclude}
            placeholder='Choose members'
            icon={<IconUser size={18} />}
            clearable
            dropdownPosition='top'
            styles={{ value: { margin: '0.25rem 0.3rem 0.25rem 0.1rem' } }}
            w={config.app.ui.short_input_width}
          />

          <Button
            variant='gradient'
            disabled={values.length === 0}
            onClick={() => {
              props.members._mutators.addRoles(values.map(x => x.id), props.role_id);
              // Close after select
              setOpened(false);
            }}
          >
            Add Members
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}


////////////////////////////////////////////////////////////
type ManagerPermissions = {
  can_manage: boolean;
  can_assign_role: boolean;
  can_manage_member_alias: boolean;
  can_manage_member_roles: boolean;
  can_kick_member: boolean;
  can_ban_member: boolean;
};

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
  managers: Record<string, Record<string, ManagerPermissions>>;
};

////////////////////////////////////////////////////////////
const DEFAULT_MANAGER_PERMISSION_SET = {
  can_manage: true,
  can_assign_role: true,
  can_manage_member_alias: false,
  can_manage_member_roles: false,
  can_kick_member: false,
  can_ban_member: false,
} as ManagerPermissions;


////////////////////////////////////////////////////////////
type RoleSettingsTabsProps = {
  domain: DomainWrapper;
  roleIdx: number;
  form: UseFormReturnType<RoleFormValues>;
  addManagers: (role_id: string, managers: Record<string, ManagerPermissions>) => void;
  session: SessionState;
};

////////////////////////////////////////////////////////////
type SubtabProps = RoleSettingsTabsProps & {
  role: Role;
}


////////////////////////////////////////////////////////////
function GeneralTab({ form, role, roleIdx }: SubtabProps) {
  // Is badge picker open
  const [badgePickerOpen, setBadgePickerOpen] = useState<boolean>(false);

  return (
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
  );
}

////////////////////////////////////////////////////////////
function ManagersTab({ domain, form, role, addManagers }: SubtabProps) {
  const theme = useMantineTheme();

  // Manager permissions for this role
  const managerAcl = useAclEntries(role.id);

  // Currently opened manager id
  const [selectedManagerId, setSelectedManagerId] = useCachedState<string | null>(`settings.${domain.id}.roles.${role.id}.selected_manager`, null);

  // Find selected manager role data
  const selectedManager = useMemo(
    () => selectedManagerId ? form.values.roles.find(x => x.id === selectedManagerId) || null : null,
    [form.values.roles, selectedManagerId]
  );


  // Manager table data
  const managerData = useMemo(() => {
    return Object.keys(form.values.managers[role.id] || {}).map(x => form.values.roles.find(y => y.id === x)).filter(x => x) as Role[];
  }, [form.values.managers[role.id], domain.roles]);

  // Manager table columns
  const managerColumns = useMemo(() => ([
    {
      name: 'Role',
      grow: 1,
      cell: (manager: Role) => (
        <Group spacing='xs'>
          <Box data-tag='allowRowEvents' h='1.5rem' pt={2} sx={(theme) => ({ color: theme.colors.dark[3] })}>
            {manager.badge ? (<Emoji id={manager.badge} size='1rem' />) : (<IconBadgeOff size={19} />)}
          </Box>
          <Text data-tag='allowRowEvents' inline size='sm' weight={600}>
            {manager.label}
          </Text>
        </Group>
      ),
    },
    {
      name: (
        <AddRolePopover
          form={form}
          type='table'
          exclude={managerData.map(x => x.id).concat([role.id])}
          onSelect={(role_id) => {
            // Add to form value
            form.setFieldValue('managers', {
              ...form.values.managers,
              [role.id]: {
                ...form.values.managers[role.id],
                [role_id]: DEFAULT_MANAGER_PERMISSION_SET,
              },
            });

            // Switch to it
            setSelectedManagerId(role_id);
          }}
        />
      ),
      width: '4rem',
      right: true,
      cell: (manager: Role) => (
        <CloseButton
          size='md'
          iconSize={18}
          onClick={() => {
            const copy = { ...form.values.managers[role.id] };
            delete copy[manager.id];

            // Add to form value
            form.setFieldValue('managers', {
              ...form.values.managers,
              [role.id]: copy,
            });

            // Switch off of it if it is selected
            if (manager.id === selectedManagerId)
              setSelectedManagerId(null);
          }}
        />
      ),
    },
  ]), [domain, managerData]);


  // Use to add manager data to form initially
  useEffect(() => {
    if (!managerAcl._exists) return;

    // Create managers map
    const map: Record<string, ManagerPermissions> = {};
    for (const entry of managerAcl.data) {
      map[entry.role] = {
        can_manage: _hasPerm(entry?.permissions, 'can_manage'),
        can_assign_role: _hasPerm(entry?.permissions, 'can_assign_role'),
        can_manage_member_alias: _hasPerm(entry?.permissions, 'can_manage_member_alias'),
        can_manage_member_roles: _hasPerm(entry?.permissions, 'can_manage_member_roles'),
        can_kick_member: _hasPerm(entry?.permissions, 'can_kick_member'),
        can_ban_member: _hasPerm(entry?.permissions, 'can_ban_member'),
      };
    }

    // Add managers to initial state
    addManagers(role.id, map);
  }, [managerAcl._exists]);

  // Used to apply on changes reset effects
  useEffect(() => {
    if (selectedManagerId && !form.values.managers[role.id]?.[selectedManagerId])
      setSelectedManagerId(null);
  }, [form.values.managers]);


  return (
    <Stack mt={20}>
      <Box>
        <Title order={4}>Managers</Title>
        <Text size='sm' color='dimmed'>
          Managers are roles that have permissions to perform certain actions on <b>{`@${role.label}`}</b> and its members.
        </Text>
      </Box>

      {managerAcl._exists && (
        <DataTable
          columns={managerColumns}
          data={managerData}
          wrapperProps={{
            maw: config.app.ui.settings_maw,
          }}
          onRowClicked={(row) => setSelectedManagerId(row.id)}
          emptyComponent={(
            <Stack align='center' spacing='sm'>
              <Text weight={600}>This role has no managers</Text>
              <AddRolePopover
                form={form}
                type='empty'
                exclude={[role.id]}
                onSelect={(role_id) => {
                  // Add to form value
                  form.setFieldValue('managers', {
                    ...form.values.managers,
                    [role.id]: {
                      ...form.values.managers[role.id],
                      [role_id]: DEFAULT_MANAGER_PERMISSION_SET,
                    },
                  });

                  // Switch to it
                  setSelectedManagerId(role_id);
                }}
              />
            </Stack>
          )}
          rowStyles={[
            {
              when: (row) => row.id === selectedManagerId,
              style: { backgroundColor: theme.colors.dark[6] },
            }
          ]}
        />
      )}

      {selectedManager && (
        <>
          <Divider maw={config.app.ui.settings_maw} />

          <Box mb={8}>
            <Group spacing='xs' mb={4}>
              <IconAt size={19} />
              <Title order={4}>Role Permissions</Title>
            </Group>
            <Text size='sm' color='dimmed'>
              Permissions the manager has over the <b>{`@${role.label}`}</b> role.
            </Text>
          </Box>

          <PermissionSetting
            title='Manage Role'
            description={<>Allows <b>{`@${selectedManager.label}`}</b> to manage the role settings of <b>{`@${role.label}`}</b>, including the role name, badge, permissions for resources for which the <b>{`@${selectedManager.label}`}</b> member manages, and other managers for which the <b>{`@${selectedManager.label}`}</b> member is also a manager of.</>}
            switchProps={form.getInputProps(`managers.${role.id}.${selectedManagerId}.can_manage`, { type: 'checkbox' })}
          />

          <PermissionSetting
            title='Assign Role'
            description={<>Allows <b>{`@${selectedManager.label}`}</b> to assign and remove the <b>{`@${role.label}`}</b> role to and from other members within the domain.</>}
            switchProps={form.getInputProps(`managers.${role.id}.${selectedManagerId}.can_assign_role`, { type: 'checkbox' })}
            withDivider={false}
          />

          <Divider maw={config.app.ui.settings_maw} mt={16} />
          <Box mb={12}>
            <Group spacing='xs' mb={4}>
              <IconUser size={19} />
              <Title order={4}>Member Permissions</Title>
            </Group>
            <Text size='sm' color='dimmed' maw={config.app.ui.settings_maw}>
              Permissions the manager has over members with the <b>{`@${role.label}`}</b> role.
              In order to perform any of the following actions, the manager must have the corresponding permission to perform the action for every one of the target member's roles,
              not just this role.
            </Text>
          </Box>

          <PermissionSetting
            title='Manage Alias'
            description={<>Allows <b>{`@${selectedManager.label}`}</b> to change the alias of members with the <b>{`@${role.label}`}</b> role.</>}
            switchProps={form.getInputProps(`managers.${role.id}.${selectedManagerId}.can_manage_member_alias`, { type: 'checkbox' })}
          />

          <PermissionSetting
            title='Manage Roles'
            description={<>Allows <b>{`@${selectedManager.label}`}</b> to manage which roles are assigned to members that have the <b>{`@${role.label}`}</b> role, regardless of whether the manager has the permission to assign the given roles.</>}
            switchProps={form.getInputProps(`managers.${role.id}.${selectedManagerId}.can_manage_member_roles`, { type: 'checkbox' })}
          />

          <PermissionSetting
            title='Can Kick'
            description={<>Allows <b>{`@${selectedManager.label}`}</b> to kick members with the <b>{`@${role.label}`}</b> role. Kicking a member removes them from the domain, but does not prevent them from rejoining the domain.</>}
            switchProps={form.getInputProps(`managers.${role.id}.${selectedManagerId}.can_kick_member`, { type: 'checkbox' })}
          />

          <PermissionSetting
            title='Can Ban'
            description={<>Allows <b>{`@${selectedManager.label}`}</b> to ban members with the <b>{`@${role.label}`}</b> role. Banning a member removes them from the domain and prevents them from rejoining the domain.</>}
            switchProps={form.getInputProps(`managers.${role.id}.${selectedManagerId}.can_ban_member`, { type: 'checkbox' })}
            withDivider={false}
          />
        </>
      )}
    </Stack>
  );
}

////////////////////////////////////////////////////////////
function PermissionsTab({ domain, form, role }: SubtabProps) {
  // Channel group permissions for this role
  const groupAcl = useAclEntriesByRole(role.id);


  // Is current role the default role
  const isDefaultRole = role.id === domain._default_role;

  // Data table
  const groupPermissionsData = useMemo<(ChannelGroup & { can_view: boolean; can_manage: boolean })[]>(() => {
    if (!groupAcl._exists) return [];

    // Only return groups that have acl entry if not default role
    if (!isDefaultRole) {
      // Map of group id to group object
      const groupMap: Record<string, ChannelGroup> = {};
      for (const group of domain.groups)
        groupMap[group.id] = group;

      const data: (ChannelGroup & { can_view: boolean; can_manage: boolean })[] = [];
      for (const entry of groupAcl.data) {
        if (!groupMap[entry.resource]) continue;
        data.push({
          ...groupMap[entry.resource],
          can_view: entry.permissions.findIndex(x => x === 'can_view') >= 0,
          can_manage: entry.permissions.findIndex(x => x === 'can_manage') >= 0,
        });
      }

      return data;
    }

    else {
      // Map of resource id to acl entry
      const aclMap: Record<string, AclEntry> = {};
      for (const entry of groupAcl.data)
        aclMap[entry.resource] = entry;

      // Show all groups if default role
      return domain.groups.map(group => ({
        ...group,
        can_view: aclMap[group.id] ? aclMap[group.id].permissions.findIndex(x => x === 'can_view') >= 0 : false,
        can_manage: aclMap[group.id] ? aclMap[group.id].permissions.findIndex(x => x === 'can_manage') >= 0 : false,
      }));
    }
  }, [domain.groups, groupAcl.data, isDefaultRole]);

  // Group override table columns
  const groupOverrideColumns = useMemo(() => {
    const cols: TableColumn<any>[] = [
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

    // Adder if not default role
    if (!isDefaultRole) {
      cols.push({
        name: (
          <Popover position='top' withArrow>
            <Popover.Target>
              <ActionIcon>
                <IconPlus size={19} />
              </ActionIcon>
            </Popover.Target>

            <AddGroupOverrideDropdown domain={domain} role={role} exclude={groupPermissionsData} />
          </Popover>
        ),
        width: '4rem',
        right: true,
      });
    }

    return cols;
  }, [isDefaultRole, groupPermissionsData]);


  return (
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
          {isDefaultRole && (<>Permissions for <b>{'@everyone'}</b> for every channel group. Click a group to modify its permissions.</>)}
          {!isDefaultRole && (<>
            Permission sets for channel groups. Users can perform any given action if any of their assigned roles allow them to,
            which means that users may have additional capabilities granted by other roles even if <b>{`@${role.label}`}</b> does not explicitly allow those actions.
          </>)}
        </Text>
      </Box>

      <DataTable
        columns={groupOverrideColumns}
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
        emptyComponent={(
          <Stack align='center' spacing='sm'>
            <Text weight={600}>This role has no extra permissions for any groups</Text>
            <Popover position='top' withArrow>
              <Popover.Target>
                <Button
                  variant='default'
                  leftIcon={<IconPlus size={18} />}
                >
                  Add Permissions
                </Button>
              </Popover.Target>

              <AddGroupOverrideDropdown domain={domain} role={role} />
            </Popover>
          </Stack>
        )}
        wrapperProps={{
          maw: config.app.ui.settings_maw,
        }}
      />
    </Stack>
  );
}

////////////////////////////////////////////////////////////
function MembersTab({ domain, role, session }: SubtabProps) {
  const { open: openConfirmModal } = useConfirmModal();

  // Real time search value
  const [search, setSearch] = useState<string>('');
  // Debounced value
  const [debouncedSearch, cancelDebounced] = useDebouncedValue(search, 300);
  // Current table page number
  const [page, setPage] = useState<number>(1);

  // Member query
  const members = useMemberQuery(domain.id, {
    search: debouncedSearch,
    role_id: role.id,
    limit: 100,
    page: page - 1,
  });

  // Cancel debounced value if there are no more members to query
  useEffect(() => {
    if (members.count !== undefined && members.count <= 100)
      cancelDebounced();
  }, [search]);

  // Filtering based on search
  const filtered = useMemo(
    () => members.data?.filter(x => x.alias.toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) >= 0) || [],
    [members.data, search]
  );


  // Members columns
  const membersColumns = useMemo(() => ([
    {
      name: 'Member',
      grow: 1,
      cell: (member: ExpandedMember) => (
        <Group noWrap>
          <MemberAvatar size={28} member={member} />
          <Text data-tag='allowRowEvents' inline size='sm'>
            {member.alias}
          </Text>
        </Group>
      ),
    },
    {
      name: members._exists ? (
        <AddMemberPopover
          type='table'
          domain_id={domain.id}
          role_id={role.id}
          exclude={members.data.map(x => x.id) || []}
          members={members}
        />
      ) : undefined,
      width: '4rem',
      right: true,
      cell: (member: ExpandedMember) => (
        <CloseButton
          size='md'
          iconSize={18}
          onClick={() => {
            openConfirmModal({
              modalProps: {
                title: 'Remove Member',
              },
              confirmLabel: 'Remove',
              content: (
                <Text>Are you sure you want to remove <b>{member.alias}</b> from the role <b>@{role.label}</b>?</Text>
              ),
              onConfirm: () => {
                if (!members._exists) return;
                members._mutators.removeRole(member.id, role.id);
              }
            })
          }}
        />
      ),
    },
  ]) as TableColumn<any>[], [members._exists]);


  return (
    <Stack mt={20}>
      <Title order={4}>Members</Title>

      <Box>
        <TextInput
          placeholder='Search'
          icon={<IconSearch size={18} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          rightSection={search.length > 0 ? (
            <CloseButton
              onClick={() => setSearch('')}
            />
          ) : undefined}
          maw={config.app.ui.settings_maw}
          mb={12}
        />

        {members._exists && (
          <DataTable
            columns={membersColumns}
            data={filtered}
            rowsPerPage={100}
            paginationServer={{
              totalRows: members.count || 0,
              onPageChange: setPage,
            }}
            wrapperProps={{
              maw: config.app.ui.settings_maw,
            }}
            emptyComponent={(
              <Stack align='center' spacing='sm'>
                <Text weight={600}>This role has no members</Text>
                <AddMemberPopover
                  type='empty'
                  domain_id={domain.id}
                  role_id={role.id}
                  members={members}
                />
              </Stack>
            )}
          />
        )}
      </Box>
    </Stack>
  );
}


////////////////////////////////////////////////////////////
function RoleSettingsTabs(props: RoleSettingsTabsProps) {
  // Use form values
  const role = props.form.values.roles[props.roleIdx];

  // The current tab that is open
  const [activeTab, setActiveTab] = useCachedState<string | null>(`settings.${props.domain.id}.roles.tab`, 'general');


  return (
    <Tabs value={activeTab} onTabChange={setActiveTab} variant='outline' keepMounted={false}>
      <Tabs.List>
        <Tabs.Tab value='general'>General</Tabs.Tab>
        <Tabs.Tab value='managers'>Managers</Tabs.Tab>
        <Tabs.Tab value='permissions'>Permissions</Tabs.Tab>
        <Tabs.Tab value='members'>Members</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value='general'>
        <GeneralTab {...props} role={role} />
      </Tabs.Panel>
      
      <Tabs.Panel value='managers'>
        <ManagersTab {...props} role={role} />
      </Tabs.Panel>

      <Tabs.Panel value='permissions'>
        <PermissionsTab {...props} role={role} />
      </Tabs.Panel>
      
      <Tabs.Panel value='members'>
        <MembersTab {...props} role={role} />
      </Tabs.Panel>
    </Tabs>
  );
}


////////////////////////////////////////////////////////////
export function RolesTab({ domain, ...props }: TabProps) {
  // Domain permissions
  const aclEntries = useAclEntries(domain.id);
  // List of manager maps per role
  const [managers, setManagers] = useState<Record<string, Record<string, ManagerPermissions>>>({});

  // Settings form
  const initialValues = useMemo(() => {
    // Map of domain permissions per role
    const domainPermissions: RoleFormValues['domain_permissions'] = {};

    for (const role of domain.roles) {
      const entry = aclEntries.data?.find(x => x.role === role.id);
      domainPermissions[role.id] = {
        can_manage: _hasPerm(entry?.permissions, 'can_manage'),
        can_manage_invites: _hasPerm(entry?.permissions, 'can_manage_invites'),
        can_create_resources: _hasPerm(entry?.permissions, 'can_create_resources'),
        can_manage_extensions: _hasPerm(entry?.permissions, 'can_manage_extensions'),
        can_create_roles: _hasPerm(entry?.permissions, 'can_create_roles'),
      };
    }

    return {
      roles: domain.roles.map(role => ({
        ...role,
        badge: role.badge || null,
        color: role.color || '',
      })),
      domain_permissions: domainPermissions,
      managers,
    } as RoleFormValues;
  }, [aclEntries.data, domain.roles, managers]);
  const form = useForm({ initialValues });

  // Role search text
  const [search, setSearch] = useState<string>('');
  // Chosen role
  const [selectedRoleId, setSelectedRoleId] = useCachedState<string | null>(`settings.${domain.id}.roles.selected`, null);

  // Reset form values on change
  useEffect(() => {
    const cached = popUnsaved(domain.id);

    if (cached) {
      // If cached unsaved values, then just set form values
      form.setValues(cached);
    }
    else if (!form.isDirty()) {
      // If no unsaved changes, apply initial values
      form.setValues(initialValues);
      form.resetDirty(initialValues);
    }
    else {
      // If have unsaved values, reset dirty initial state then set form value to a merged version
      form.setValues(merge({}, initialValues, form.values));
      form.resetDirty(initialValues);
    }
  }, [initialValues]);

  // Filtered roles
  const filteredRoles = useMemo(() => {
    if (search.length === 0)
      return form.values.roles;

    const query = search.toLowerCase();
    return form.values.roles.filter(x => x.label.toLowerCase().indexOf(query) >= 0);
  }, [form.values.roles, search]);

  // Index of role
  const selectedIdx = useMemo(() => {
    if (!selectedRoleId) return null;
    return form.values.roles.findIndex(x => x.id === selectedRoleId);
  }, [selectedRoleId, form.values.roles]);


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
        <Text size={11} color='dimmed'>
          {'(Drag and drop items to reorder roles)'}
        </Text>
      </Box>

      <Box>
        <Group maw={config.app.ui.settings_maw} align='end' spacing='xs' mb={8}>
          <TextInput
            placeholder='Search'
            icon={<IconSearch size={18} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            rightSection={search.length > 0 ? (
              <CloseButton
                onClick={() => setSearch('')}
              />
            ) : undefined}
            style={{ flexGrow: 1 }}
          />
          <Button
            variant='gradient'
            onClick={() => {
              // Temp uuid
              const id = uuid();

              // Append new role
              form.setFieldValue('roles', [
                ...form.values.roles, {
                  id,
                  domain: domain.id,
                  label: 'New Role',
                },
              ]);

              // Switch to it
              setSelectedRoleId(id);
            }}
          >
            New Role
          </Button>
        </Group>

        <DragDropContext onDragEnd={(result) => {
          if (!result.destination) return;
          const from = result.source.index;
          const to = result.destination.index;

          const copy = form.values.roles.slice();
          const role = copy.splice(from, 1)[0];
          copy.splice(to, 0, role);

          form.setFieldValue('roles', copy);
        }}>
          <Droppable droppableId={domain.id}>
            {(provided) => (
              <Stack
                ref={provided.innerRef}
                spacing={0}
                maw={config.app.ui.settings_maw}
                sx={(theme) => ({
                  padding: '0.5rem',
                  backgroundColor: theme.colors.dark[8],
                })}
                {...provided.droppableProps}
              >
                {filteredRoles.map((role, idx) => (
                  <Draggable key={role.id} draggableId={role.id} index={idx}>
                    {(provided, snapshot) => (
                      <PortalAwareItem snapshot={snapshot}>
                        <Box
                          ref={provided.innerRef}
                          w='100%'
                          p='0.4rem 0.6rem'
                          sx={(theme) => ({
                            backgroundColor: selectedRoleId === role.id || snapshot.isDragging ? theme.colors.dark[7] : theme.colors.dark[8],
                            boxShadow: snapshot.isDragging ? '0px 0px 10px #00000033' : undefined,
                            borderRadius: theme.radius.sm,

                            '&:hover': {
                              backgroundColor: theme.colors.dark[7],
                            },
                          })}
                          onClick={() => setSelectedRoleId(role.id)}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={{
                            ...provided.draggableProps.style,
                            cursor: 'pointer',
                          }}
                        >
                          <Group spacing='xs' sx={(theme) => ({ '.tabler-icon': { color: theme.colors.dark[3] } })}>
                            <div style={{ height: '1.5rem' }}>
                              {role.badge ? (<Emoji id={role.badge} size='1rem' />) : (<IconBadgeOff size={19} style={{ marginTop: 2 }} />)}
                            </div>
                            <Text inline size='sm' weight={600}>
                              {role.label}
                            </Text>
                            <div style={{ flexGrow: 1 }} />
                            {role.color && <ColorSwatch color={role.color} size='1.0rem' />}
                          </Group>
                        </Box>
                      </PortalAwareItem>
                    )}
                  </Draggable>
                ))}

                {provided.placeholder}
              </Stack>
            )}
          </Droppable>
        </DragDropContext>
      </Box>

      {selectedIdx !== null && (
        <>
          <Divider sx={(theme) => ({ borderColor: theme.colors.dark[5] })} />
          <Title order={3} mb={8}>Edit - {'@'}{form.values.roles[selectedIdx].label}</Title>

          <RoleSettingsTabs
            key={selectedRoleId}
            domain={domain}
            roleIdx={selectedIdx}
            form={form}
            addManagers={(role_id, newManagers) => {
              setManagers({ ...managers, [role_id]: newManagers });
            }}
            session={props.session}
          />
        </>
      )}

      <SettingsModal.Unsaved
        form={form}
        initialValues={initialValues}
        onReset={() => {
          // Go to empty role if current role does not exist after reset
          if (selectedRoleId && initialValues.roles.findIndex(x => x.id === selectedRoleId) < 0)
            setSelectedRoleId(null);
        }}
        onSave={async () => {
          // Recreate original roles
          const original: Record<string, Role> = {};
          for (const role of initialValues.roles)
            original[role.id] = role;

          // Detect changes
          const unaccounted = new Set<string>(Object.keys(original));
          const changes: Record<string, Partial<Role>> = {};
          const newRoles: Record<string, Partial<Role>> = {};
          let orderChanged = false;

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
              const roleDiff = diff(original[role.id], role);

              // Record diff
              if (roleDiff !== undefined)
                changes[role.id] = roleDiff;

              // Mark as accounted for
              unaccounted.delete(role.id);

              // Check if order changed, 
              if (i >= initialValues.roles.length || role.id !== initialValues.roles[i].id)
                orderChanged = true;
            }
          }

          // The remaining values in unaccounted are deleted
          if (unaccounted.size > 0 || Object.keys(changes).length > 0 || Object.keys(newRoles).length > 0 || orderChanged) {
            await domain._mutators.updateRoles({
              added: Object.values(newRoles),
              changed: changes,
              deleted: Array.from(unaccounted),
              order: orderChanged ? form.values.roles.map(x => x.id) : undefined,
            }).catch(() => {});
          }

          // Set manager permissions if changed
          const managerPermsDiff = diff(initialValues.managers, form.values.managers);
          if (managerPermsDiff && Object.keys(managerPermsDiff).length > 0) {
            // Iterate roles and apply acl entries for each manager within each role
            for (const [role_id, managers] of Object.entries(managerPermsDiff)) {
              if (!managers || Object.keys(managers).length === 0) continue;

              // Get permissions list for each one that changed
              const permChanges: Record<string, AllPermissions[]> = {};
              for (const manager_id of Object.keys(managers || {}))
                permChanges[manager_id] = Object.entries(form.values.managers[role_id][manager_id] || {}).filter(([k, v]) => v).map(x => x[0]).sort() as AllPermissions[];

              // Mutation
              await setPermissions(role_id, permChanges, props.session).catch(() => {});
            }
          }

          // Set domain permissions if changed
          const domainPermsDiff = diff(initialValues.domain_permissions, form.values.domain_permissions);
          if (aclEntries._exists && domainPermsDiff && Object.keys(domainPermsDiff).length > 0) {
            // Get permissions list for each one that changed
            const permChanges: Record<string, AllPermissions[]> = {};
            for (const role_id of Object.keys(domainPermsDiff || {}))
              permChanges[role_id] = Object.entries(form.values.domain_permissions[role_id]).filter(([k, v]) => v).map(x => x[0]).sort() as AllPermissions[];

            // Mutation
            await aclEntries._mutators.setPermissions(permChanges).catch(() => {});
          }
        }}
      />
    </>
  );
}