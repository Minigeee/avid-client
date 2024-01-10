import {
  ReactNode,
  RefObject,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSWRConfig } from 'swr';
import assert from 'assert';

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
  Flex,
  Group,
  Menu,
  Popover,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
  useMantineTheme,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDebouncedValue } from '@mantine/hooks';
import { UseFormReturnType } from '@mantine/form/lib/types';

import {
  IconAt,
  IconBadgeOff,
  IconBuildingCommunity,
  IconCheck,
  IconDotsVertical,
  IconEye,
  IconEyeOff,
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
import {
  SettingsModal,
  popUnsaved,
  pushUnsaved,
} from '@/lib/ui/components/settings/SettingsModal';
import { useConfirmModal } from '@/lib/ui/modals/ConfirmModal';

import config from '@/config';
import { SessionState } from '@/lib/contexts';
import {
  AclEntriesWrapper,
  DomainWrapper,
  canSetPermissions,
  listMembers,
  hasPermission,
  useAclEntries,
  useAclEntriesByRole,
  useCachedState,
  useDomain,
  useMemberQuery,
  setAclEntries,
  useSession,
  MemberMutators,
  useMemberMutators,
} from '@/lib/hooks';
import {
  AclEntry,
  AllChannelPermissions,
  AllPermissions,
  ChannelGroup,
  ChannelTypes,
  ExpandedMember,
  Role,
} from '@/lib/types';
import { diff } from '@/lib/utility';

import { TableColumn } from 'react-data-table-component';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import { merge } from 'lodash';

////////////////////////////////////////////////////////////
const PRESET_COLORS: string[] = [];
for (const [name, colors] of Object.entries(DEFAULT_THEME.colors)) {
  if (name === 'red' || name === 'gray' || name === 'yellow' || name === 'lime')
    PRESET_COLORS.push(colors[7]);
  else if (name !== 'dark') PRESET_COLORS.push(colors[6]);
}
PRESET_COLORS.push(DEFAULT_THEME.colors.gray[6]);

////////////////////////////////////////////////////////////
type TabProps = {
  session: SessionState;
  domain: DomainWrapper;
};

////////////////////////////////////////////////////////////
function _hasPerm(
  list: AllPermissions[] | undefined,
  permission: AllPermissions,
) {
  return list ? list.findIndex((x) => x === permission) >= 0 : false;
}

////////////////////////////////////////////////////////////
function GroupPermissoinsExpandableRows({
  data,
  domain,
}: {
  data: ChannelGroup;
  domain: DomainWrapper;
}) {
  return (
    <Stack spacing={0} pt={6} pb={6}>
      {data.channels.map((channel_id, idx) => (
        <Group key={channel_id} spacing='xs' p='0.3rem 0.6rem'>
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
function AddGroupOverrideDropdown(props: {
  domain: DomainWrapper;
  role: Role;
  data: ChannelGroup[];
}) {
  const groups = useMemo(
    () => props.data.map((x) => ({ value: x.id, label: x.name })),
    [props.data],
  );

  return (
    <Popover.Dropdown>
      <Select
        placeholder='Choose a  group'
        data={groups}
        icon={<IconFolder size={16} />}
        searchable
        onChange={(value) =>
          openChannelGroupSettings({
            domain_id: props.domain.id,
            group: props.domain.groups.find(
              (x) => x.id === value,
            ) as ChannelGroup,
            tab: 'permissions',
            role: props.role,
          })
        }
      />
    </Popover.Dropdown>
  );
}

////////////////////////////////////////////////////////////
const RoleSelectItem = forwardRef<
  HTMLDivElement,
  { label: string; badge: string }
>(({ label, badge, ...others }, ref) => (
  <div ref={ref} {...others}>
    <Group spacing='xs' noWrap>
      <Box
        h='1.5rem'
        pt={2}
        sx={(theme) => ({ color: theme.other.colors.page_dimmed })}
      >
        {badge ? <Emoji id={badge} size='1rem' /> : <IconBadgeOff size={19} />}
      </Box>
      <Text size='sm'>{label}</Text>
    </Group>
  </div>
));
RoleSelectItem.displayName = 'RoleSelectItem';

////////////////////////////////////////////////////////////
function AddRolePopover(props: {
  form: UseFormReturnType<RoleFormValues>;
  onSelect: (role_id: string) => void;
  data: Role[];
  type: 'empty' | 'table';
}) {
  const [opened, setOpened] = useState<boolean>(false);

  const roles = useMemo(
    () =>
      props.data.map((x) => ({ value: x.id, label: x.label, badge: x.badge })),
    [props.data],
  );

  return (
    <Popover
      opened={opened}
      position='top'
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
            Add Child Role
          </Button>
        </Popover.Target>
      )}

      <Popover.Dropdown
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
      >
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
function AddMemberPopover(props: {
  domain_id: string;
  role_id: string;
  mutators: MemberMutators;
  type: 'empty' | 'table';
}) {
  const [opened, setOpened] = useState<boolean>(false);
  const [values, setValues] = useState<ExpandedMember[]>([]);

  return (
    <Popover
      opened={opened}
      position='top'
      withArrow
      closeOnClickOutside
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
            placeholder='Choose members'
            exclude_role={props.role_id}
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
              props.mutators.addRoles(
                props.domain_id,
                values.map((x) => x.id),
                props.role_id,
              );
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
type ChildRolePermissions = {
  can_manage: boolean;
  can_manage_permissions: boolean;
  can_delete_role: boolean;
  can_assign_role: boolean;
  can_manage_member_alias: boolean;
  can_manage_member_roles: boolean;
  can_kick_member: boolean;
  can_ban_member: boolean;
};

////////////////////////////////////////////////////////////
type RoleFormValues = {
  roles: Role[];
  domain_permissions: Record<
    string,
    {
      can_manage: boolean;
      can_manage_invites: boolean;
      can_manage_resources: boolean;
      can_manage_extensions: boolean;
      can_create_groups: boolean;
      can_create_roles: boolean;
    }
  >;
  /** Map of role ids to the sets of permissions for every role for which the role is a parent of */
  child_roles: Record<string, Record<string, ChildRolePermissions>>;
};

////////////////////////////////////////////////////////////
const DEFAULT_MANAGER_PERMISSION_SET = {
  can_manage: false,
  can_manage_permissions: true,
  can_delete_role: false,
  can_assign_role: false,
  can_manage_member_alias: false,
  can_manage_member_roles: false,
  can_kick_member: false,
  can_ban_member: false,
} as ChildRolePermissions;

////////////////////////////////////////////////////////////
type RoleSettingsTabsProps = {
  domain: DomainWrapper;
  domainAcl: AclEntriesWrapper;
  roleIdx: number;
  form: UseFormReturnType<RoleFormValues>;
  addChildRoles: (
    role_id: string,
    roles: Record<string, ChildRolePermissions>,
  ) => void;
  setSelectedRoleId: (id: string | null) => void;
  session: SessionState;
};

////////////////////////////////////////////////////////////
type SubtabProps = RoleSettingsTabsProps & {
  role: Role;
};

////////////////////////////////////////////////////////////
function GeneralTab({
  domain,
  form,
  role,
  roleIdx,
  session,
  setSelectedRoleId,
}: SubtabProps) {
  const { open: openConfirmModal } = useConfirmModal();

  // Used to indicate if member query is loading
  const [loading, setLoading] = useState<boolean>(false);
  // Is badge picker open
  const [badgePickerOpen, setBadgePickerOpen] = useState<boolean>(false);

  // Indicates if user can manage role
  const canManage = hasPermission(domain, role.id, 'can_manage');

  return (
    <Stack mt={20}>
      <TextInput
        label='Name'
        disabled={!canManage}
        sx={{ width: config.app.ui.med_input_width }}
        {...form.getInputProps(`roles.${roleIdx}.label`)}
      />

      <div>
        <Text size='sm' weight={600}>
          Badge
        </Text>
        <Text size='xs' color='dimmed' mb={6}>
          A role badge is an icon displayed next to a user&apos;s name in chat
        </Text>

        <Group mt={8} spacing={4}>
          <Center
            mr={8}
            sx={(theme) => ({
              height: '2.75rem',
              width: '2.75rem',
              background: role.badge
                ? undefined
                : theme.other.elements.settings_panel,
              color: theme.other.elements.settings_panel_dimmed,
              borderRadius: '3rem',
            })}
          >
            {role.badge ? (
              <Emoji id={role.badge} size='2rem' />
            ) : (
              <IconBadgeOff size='1.75rem' />
            )}
          </Center>

          <Popover
            opened={badgePickerOpen}
            withinPortal
            withArrow
            onClose={() => setBadgePickerOpen(false)}
          >
            <Popover.Target>
              <Button
                disabled={!canManage}
                variant='default'
                ml={4}
                mr={8}
                onClick={() => setBadgePickerOpen(!badgePickerOpen)}
              >
                {role.badge ? 'Change' : 'Add'} Badge
              </Button>
            </Popover.Target>
            <Popover.Dropdown p='0.75rem 1rem'>
              <EmojiPicker
                emojiSize={32}
                onSelect={(emoji) => {
                  form.setFieldValue(`roles.${roleIdx}.badge`, emoji.id);
                  setBadgePickerOpen(false);
                }}
              />
            </Popover.Dropdown>
          </Popover>

          {canManage && role.badge && (
            <>
              <ActionButton
                tooltip={role.show_badge ? 'Hide In Chat' : 'Show In Chat'}
                sx={(theme) => ({
                  color: theme.other.elements.settings_dimmed,
                  '&:hover': {
                    background: theme.other.elements.settings_hover,
                  },
                })}
                onClick={() => {
                  const copy = form.values.roles.slice();
                  copy[roleIdx] = { ...role, show_badge: !role.show_badge };

                  form.setFieldValue('roles', copy);
                }}
              >
                {role.show_badge && <IconEye size={24} />}
                {!role.show_badge && <IconEyeOff size={24} />}
              </ActionButton>

              <CloseButton
                size='md'
                sx={(theme) => ({
                  color: theme.other.elements.settings_dimmed,
                  '&:hover': {
                    background: theme.other.elements.settings_hover,
                  },
                })}
                onClick={() =>
                  form.setFieldValue(`roles.${roleIdx}.badge`, null)
                }
              />
            </>
          )}
        </Group>
      </div>

      {hasPermission(domain, role.id, 'can_delete_role') &&
        role.id !== domain._default_role && (
          <>
            <Divider maw={config.app.ui.settings_maw} />

            <Flex
              align='center'
              wrap='nowrap'
              gap='1.0rem'
              maw={config.app.ui.settings_maw}
              sx={(theme) => ({
                padding: '0.75rem 1rem',
                background: theme.other.elements.settings_panel,
                borderRadius: theme.radius.sm,
              })}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Text
                  size='sm'
                  weight={600}
                  mb={2}
                  sx={(theme) => ({
                    color: theme.other.elements.settings_panel_text,
                  })}
                >
                  Delete this role
                </Text>
                <Text size='xs' color='dimmed'>
                  This action will be performed immediately and can not be
                  undone.
                </Text>
              </Box>

              <Button
                color='red'
                variant='outline'
                loading={loading}
                onClick={async () => {
                  setLoading(true);

                  // Get number of members
                  const { count } = await listMembers(
                    domain.id,
                    {
                      role_id: role.id,
                      no_data: true,
                    },
                    session,
                  );

                  setLoading(false);

                  // Make user confirm action
                  openConfirmModal({
                    title: 'Delete Role',
                    content: (
                      <Text>
                        Are you sure you want to delete <b>@{role.label}</b>?
                        This role will be removed from <b>{count}</b> member
                        {count !== 1 ? 's' : ''}.
                      </Text>
                    ),
                    confirmLabel: 'Delete',
                    confirmText: (
                      <>
                        Please type <b>{role.label}</b> to confirm this action.
                      </>
                    ),
                    typeToConfirm: (count || 0) >= 5 ? role.label : undefined,
                    onConfirm: async () => {
                      // Delete role
                      await domain._mutators.deleteRole(role.id);

                      // Switch off of it
                      setSelectedRoleId(null);
                    },
                  });
                }}
              >
                Delete Role
              </Button>
            </Flex>
          </>
        )}
    </Stack>
  );
}

////////////////////////////////////////////////////////////
function ChildRolesTab({
  domain,
  form,
  role,
  roleAcl,
}: SubtabProps & { roleAcl: AclEntriesWrapper }) {
  const theme = useMantineTheme();

  // Currently opened manager id
  const [selectedChildId, setSelectedChildId] = useCachedState<string | null>(
    `settings.${domain.id}.roles.${role.id}.selected_child`,
    null,
  );

  // Find selected manager role data
  const selectedChild = useMemo(
    () =>
      selectedChildId
        ? form.values.roles.find((x) => x.id === selectedChildId) || null
        : null,
    [form.values.roles, selectedChildId],
  );

  // Child roles table data
  const childData = useMemo(() => {
    const entries = roleAcl.data.filter((entry) =>
      entry.resource.startsWith('roles'),
    );
    const canManageRole = hasPermission(domain, role.id, 'can_manage');

    // Check which entries can be deleted
    const canDelete = entries.map((entry) => {
      let canDelete = canSetPermissions(domain, entry);
      for (const perm of entry.permissions)
        canDelete = canDelete && hasPermission(domain, entry.resource, perm);
      return canDelete;
    });

    // Add any missing from form
    for (const [childId, perms] of Object.entries(
      form.values.child_roles[role.id] || {},
    )) {
      if (entries.findIndex((x) => x.resource === childId) < 0) {
        entries.push({
          domain: domain.id,
          resource: childId,
          role: role.id,
          permissions: Object.entries(perms)
            .filter(([k, v]) => v)
            .map(([k, v]) => k) as AllPermissions[],
        });
        canDelete.push(true);
      }
    }

    // Construct child roles array
    const children: (Role & { can_delete: boolean })[] = [];
    for (let i = 0; i < entries.length; ++i) {
      const entry = entries[i];
      if (!form.values.child_roles[role.id]?.[entry.resource]) continue;
      // In order to view an acl entry, user has to manage either the role or the child role
      if (
        !canManageRole &&
        !hasPermission(domain, entry.resource, 'can_manage')
      )
        continue;

      const child = form.values.roles.find((x) => x.id === entry.resource);
      if (!child) continue;

      children.push({ ...child, can_delete: canDelete[i] });
    }

    return children;
  }, [form.values.child_roles[role.id], domain._permissions]);

  // Values to user can add
  const addableChildren = useMemo(
    () =>
      domain.roles.filter(
        (x) =>
          canSetPermissions(domain, { role: role.id, resource: x.id }) &&
          childData.findIndex((r) => r.id === x.id) < 0 &&
          x.id !== role.id,
      ),
    [childData, domain.roles, domain._permissions],
  );

  // Child roles table columns
  const childColumns = useMemo(
    () => [
      {
        name: 'Role',
        grow: 1,
        cell: (child: Role) => (
          <Group spacing='xs'>
            <Box
              data-tag='allowRowEvents'
              h='1.5rem'
              pt={2}
              sx={(theme) => ({
                color: theme.other.elements.data_table_dimmed,
              })}
            >
              {child.badge ? (
                <Emoji id={child.badge} size='1rem' />
              ) : (
                <IconBadgeOff size={19} />
              )}
            </Box>
            <Text data-tag='allowRowEvents' inline size='sm' weight={600}>
              {child.label}
            </Text>
          </Group>
        ),
      },
      {
        name: (
          <AddRolePopover
            form={form}
            type='table'
            data={addableChildren}
            onSelect={(role_id) => {
              // Add to form value
              form.setFieldValue('child_roles', {
                ...form.values.child_roles,
                [role.id]: {
                  ...form.values.child_roles[role.id],
                  [role_id]: DEFAULT_MANAGER_PERMISSION_SET,
                },
              });

              // Switch to it
              setSelectedChildId(role_id);
            }}
          />
        ),
        width: '4rem',
        right: true,
        cell: (child: Role & { can_delete: boolean }) =>
          child.can_delete ? (
            <CloseButton
              size='md'
              iconSize={18}
              onClick={() => {
                const copy = { ...form.values.child_roles[role.id] };
                delete copy[child.id];

                // Add to form value
                form.setFieldValue('child_roles', {
                  ...form.values.child_roles,
                  [role.id]: copy,
                });

                // Switch off of it if it is selected
                if (child.id === selectedChildId) setSelectedChildId(null);
              }}
            />
          ) : null,
      },
    ],
    [domain, childData],
  );

  // Used to apply on changes reset effects
  useEffect(() => {
    if (selectedChildId && !form.values.child_roles[role.id]?.[selectedChildId])
      setSelectedChildId(null);
  }, [form.values.child_roles]);

  // Map of which permissions able to set
  const _perms = useMemo(() => {
    const entry = roleAcl.data?.find((x) => x.role === selectedChildId) || {
      id: '',
      domain: '',
      role: role.id,
      resource: selectedChildId || '',
      permissions: [],
    };
    const childId = selectedChildId || '';

    const canSet = canSetPermissions(domain, entry);
    return {
      can_set: canSet,
      can_manage: canSet && hasPermission(domain, childId, 'can_manage'),
      can_manage_permissions:
        canSet && hasPermission(domain, childId, 'can_manage_permissions'),
      can_delete_role:
        canSet && hasPermission(domain, childId, 'can_delete_role'),
      can_assign_role:
        canSet && hasPermission(domain, childId, 'can_assign_role'),
      can_manage_member_alias:
        canSet && hasPermission(domain, childId, 'can_manage_member_alias'),
      can_manage_member_roles:
        canSet && hasPermission(domain, childId, 'can_manage_member_roles'),
      can_kick_member:
        canSet && hasPermission(domain, childId, 'can_kick_member'),
      can_ban_member:
        canSet && hasPermission(domain, childId, 'can_ban_member'),
    };
  }, [roleAcl.data, selectedChildId]);

  // Dont render until data added to form
  if (!form.values.child_roles[role.id]) return null;

  return (
    <Stack mt={20}>
      <Box>
        <Title order={4}>Child Roles</Title>
        <Text size='sm' color='dimmed'>
          Child roles are roles that <b>{`@${role.label}`}</b> has permissions
          over.
        </Text>
      </Box>

      <DataTable
        columns={childColumns}
        data={childData}
        wrapperProps={{
          maw: config.app.ui.settings_maw,
        }}
        onRowClicked={(row) => setSelectedChildId(row.id)}
        emptyComponent={
          <Stack align='center' spacing='sm'>
            <Text weight={600}>This role has no child roles</Text>
            <AddRolePopover
              form={form}
              type='empty'
              data={addableChildren}
              onSelect={(role_id) => {
                // Add to form value
                form.setFieldValue('child_roles', {
                  ...form.values.child_roles,
                  [role.id]: {
                    ...form.values.child_roles[role.id],
                    [role_id]: DEFAULT_MANAGER_PERMISSION_SET,
                  },
                });

                // Switch to it
                setSelectedChildId(role_id);
              }}
            />
          </Stack>
        }
        rowStyles={[
          {
            when: (row) => row.id === selectedChildId,
            style: { background: theme.other.elements.data_table_hover },
          },
        ]}
      />

      {selectedChild && (
        <>
          <Divider maw={config.app.ui.settings_maw} />

          <Box mb={8}>
            <Group spacing='xs' mb={4}>
              <IconAt size={19} />
              <Title order={4}>Role Permissions</Title>
            </Group>
            <Text size='sm' color='dimmed'>
              Permissions the parent role has over the{' '}
              <b>{`@${selectedChild.label}`}</b> role.
            </Text>
          </Box>

          <PermissionSetting
            title='Manage Role'
            description={
              <>
                Allows <b>{`@${role.label}`}</b> to manage the role settings of{' '}
                <b>{`@${selectedChild.label}`}</b>, including the role name,
                badge, and other managers of the role.
              </>
            }
            switchProps={form.getInputProps(
              `child_roles.${role.id}.${selectedChildId}.can_manage`,
              { type: 'checkbox' },
            )}
            disabled={!_perms.can_manage}
          />

          <PermissionSetting
            title='Manage Permissions'
            description={
              <>
                Allows <b>{`@${role.label}`}</b> to manage the permissions of{' '}
                <b>{`@${selectedChild.label}`}</b>. This permission is required
                for members of <b>{`@${role.label}`}</b> to modify{' '}
                <b>{`@${selectedChild.label}`}</b> permissions for any section
                or resource, but they must be able to manage that {config.text.channel.base_lc} to modify
                its permissions.
              </>
            }
            switchProps={form.getInputProps(
              `child_roles.${role.id}.${selectedChildId}.can_manage_permissions`,
              { type: 'checkbox' },
            )}
            disabled={!_perms.can_manage_permissions}
          />

          <PermissionSetting
            title='Delete Role'
            description={
              <>
                Allows <b>{`@${role.label}`}</b> to delete the{' '}
                <b>{`@${selectedChild.label}`}</b> role.
              </>
            }
            switchProps={form.getInputProps(
              `child_roles.${role.id}.${selectedChildId}.can_delete_role`,
              { type: 'checkbox' },
            )}
            disabled={!_perms.can_delete_role}
            show={selectedChild.id !== domain._default_role}
          />

          <PermissionSetting
            title='Assign Role'
            description={
              <>
                Allows <b>{`@${role.label}`}</b> to assign and remove the{' '}
                <b>{`@${selectedChild.label}`}</b> role to and from other
                members within the {config.text.domain.base_lc}.
              </>
            }
            switchProps={form.getInputProps(
              `child_roles.${role.id}.${selectedChildId}.can_assign_role`,
              { type: 'checkbox' },
            )}
            disabled={!_perms.can_assign_role}
            withDivider={false}
          />

          <Divider maw={config.app.ui.settings_maw} mt={16} />
          <Box mb={12}>
            <Group spacing='xs' mb={4}>
              <IconUser size={19} />
              <Title order={4}>Member Permissions</Title>
            </Group>
            <Text size='sm' color='dimmed' maw={config.app.ui.settings_maw}>
              Permissions the parent has over members with the{' '}
              <b>{`@${selectedChild.label}`}</b> role. In order to perform any
              of the following actions, a user must have the corresponding
              permission to perform the action for every one of the target
              member&apos;s roles, not just this role.
            </Text>
          </Box>

          <PermissionSetting
            title='Manage Alias'
            description={
              <>
                Allows <b>{`@${role.label}`}</b> to change the alias of members
                with the <b>{`@${selectedChild.label}`}</b> role.
              </>
            }
            switchProps={form.getInputProps(
              `child_roles.${role.id}.${selectedChildId}.can_manage_member_alias`,
              { type: 'checkbox' },
            )}
            disabled={!_perms.can_manage_member_alias}
          />

          <PermissionSetting
            title='Manage Roles'
            description={
              <>
                Allows <b>{`@${role.label}`}</b> to manage which roles are
                assigned to members that have the{' '}
                <b>{`@${selectedChild.label}`}</b> role, regardless of whether
                the manager has the permission to assign those roles.
              </>
            }
            switchProps={form.getInputProps(
              `child_roles.${role.id}.${selectedChildId}.can_manage_member_roles`,
              { type: 'checkbox' },
            )}
            disabled={!_perms.can_manage_member_roles}
          />

          <PermissionSetting
            title='Can Kick'
            description={
              <>
                Allows <b>{`@${role.label}`}</b> to kick members with the{' '}
                <b>{`@${selectedChild.label}`}</b> role. Kicking a member
                removes them from the {config.text.domain.base_lc}, but does not prevent them from
                rejoining the {config.text.domain.base_lc}.
              </>
            }
            switchProps={form.getInputProps(
              `child_roles.${role.id}.${selectedChildId}.can_kick_member`,
              { type: 'checkbox' },
            )}
            disabled={!_perms.can_kick_member}
          />

          <PermissionSetting
            title='Can Ban'
            description={
              <>
                Allows <b>{`@${role.label}`}</b> to ban members with the{' '}
                <b>{`@${selectedChild.label}`}</b> role. Banning a member
                removes them from the {config.text.domain.base_lc} and prevents them from rejoining
                the {config.text.domain.base_lc}.
              </>
            }
            switchProps={form.getInputProps(
              `child_roles.${role.id}.${selectedChildId}.can_ban_member`,
              { type: 'checkbox' },
            )}
            disabled={!_perms.can_ban_member}
            withDivider={false}
          />
        </>
      )}
    </Stack>
  );
}

////////////////////////////////////////////////////////////
function PermissionsTab({
  domain,
  domainAcl,
  form,
  role,
  roleAcl,
}: SubtabProps & { roleAcl: AclEntriesWrapper }) {
  // Is current role the default role
  const isDefaultRole = role.id === domain._default_role;

  // Data table
  const groupPermissionsData = useMemo<
    (ChannelGroup & { can_view: boolean; can_manage: boolean })[]
  >(() => {
    // Only return groups that have acl entry if not default role
    if (!isDefaultRole) {
      // Map of group id to group object
      const groupMap: Record<string, ChannelGroup> = {};
      for (const group of domain.groups) groupMap[group.id] = group;

      const data: (ChannelGroup & {
        can_view: boolean;
        can_manage: boolean;
      })[] = [];
      for (const entry of roleAcl.data) {
        if (
          !groupMap[entry.resource] ||
          (!hasPermission(domain, entry.resource, 'can_manage') &&
            !hasPermission(domain, entry.role, 'can_manage'))
        )
          continue;

        data.push({
          ...groupMap[entry.resource],
          can_view: entry.permissions.findIndex((x) => x === 'can_view') >= 0,
          can_manage:
            entry.permissions.findIndex((x) => x === 'can_manage') >= 0,
        });
      }

      return data;
    } else {
      // Map of resource id to acl entry
      const aclMap: Record<string, AclEntry> = {};
      for (const entry of roleAcl.data) {
        if (!entry.resource.startsWith('roles')) aclMap[entry.resource] = entry;
      }

      // Show all groups if default role
      return domain.groups
        .map((group) => ({
          ...group,
          can_view: aclMap[group.id]
            ? aclMap[group.id].permissions.findIndex((x) => x === 'can_view') >=
              0
            : false,
          can_manage: aclMap[group.id]
            ? aclMap[group.id].permissions.findIndex(
                (x) => x === 'can_manage',
              ) >= 0
            : false,
        }))
        .filter(
          (x) =>
            hasPermission(domain, x.id, 'can_manage') ||
            hasPermission(domain, role.id, 'can_manage'),
        );
    }
  }, [domain.groups, domain._permissions, roleAcl.data, isDefaultRole]);

  // Addable channel groups
  const addableGroups = useMemo(
    () =>
      domain.groups.filter(
        (x) =>
          canSetPermissions(domain, { resource: x.id, role: role.id }) &&
          groupPermissionsData.findIndex((g) => g.id === x.id) < 0,
      ),
    [groupPermissionsData, domain.groups, domain._permissions],
  );

  // Map of which permissions able to set
  const _perms = useMemo(() => {
    const entry = domainAcl.data.find((x) => x.role === role.id) || {
      id: '',
      domain: '',
      role: role.id,
      resource: domain.id,
      permissions: [],
    };

    const canSet = canSetPermissions(domain, entry);
    return {
      can_set: canSet,
      can_manage: canSet && hasPermission(domain, domain.id, 'can_manage'),
      can_manage_invites:
        canSet && hasPermission(domain, domain.id, 'can_manage_invites'),
      can_manage_extensions:
        canSet && hasPermission(domain, domain.id, 'can_manage_extensions'),
      can_create_groups:
        canSet && hasPermission(domain, domain.id, 'can_create_groups'),
      can_create_roles:
        canSet && hasPermission(domain, domain.id, 'can_create_roles'),

      can_set_role_permissions: hasPermission(
        domain,
        role.id,
        'can_manage_permissions',
      ),
    };
  }, [domainAcl.data]);

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
        cell: (group: { can_view: boolean }) =>
          group.can_view ? (
            <Box sx={(theme) => ({ color: theme.colors.green[5] })}>
              <IconCheck data-tag='allowRowEvents' size={20} />
            </Box>
          ) : (
            <Box sx={(theme) => ({ color: theme.colors.red[5] })}>
              <IconX data-tag='allowRowEvents' size={20} />
            </Box>
          ),
      },
      {
        name: 'Can Manage',
        center: true,
        width: '8rem',
        cell: (group: { can_manage: boolean }) =>
          group.can_manage ? (
            <Box sx={(theme) => ({ color: theme.colors.green[5] })}>
              <IconCheck data-tag='allowRowEvents' size={20} />
            </Box>
          ) : (
            <Box sx={(theme) => ({ color: theme.colors.red[5] })}>
              <IconX data-tag='allowRowEvents' size={20} />
            </Box>
          ),
      },
    ];

    // Adder if not default role
    if (!isDefaultRole) {
      cols.push({
        name: (
          <Popover position='top' withArrow>
            {_perms.can_set_role_permissions && addableGroups.length > 0 && (
              <Popover.Target>
                <ActionIcon>
                  <IconPlus size={19} />
                </ActionIcon>
              </Popover.Target>
            )}

            <AddGroupOverrideDropdown
              domain={domain}
              role={role}
              data={addableGroups}
            />
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
      {hasPermission(domain, domain.id, 'can_manage') && (
        <>
          <Box mb={8}>
            <Group spacing='xs' mb={4}>
              <IconBuildingCommunity size={19} />
              <Title order={4}>{config.text.domain.base} Permissions</Title>
            </Group>
            <Text size='sm' color='dimmed'>
              General permissions that apply to the {config.text.domain.base_lc}
              .
            </Text>
          </Box>

          <PermissionSetting
            title={`Manage ${config.text.domain.base}`}
            description={
              <>
                Allows <b>{`@${role.label}`}</b> to manage{' '}
                {config.text.domain.base_lc} settings, including the{' '}
                {config.text.domain.base_lc} name, icon, and banner, and to
                manage {config.text.domain.base_lc} related permissions.
              </>
            }
            switchProps={form.getInputProps(
              `domain_permissions.${role.id}.can_manage`,
              { type: 'checkbox' },
            )}
            disabled={!_perms.can_manage}
          />

          <PermissionSetting
            title='Manage Invites'
            description={
              <>
                Allows <b>{`@${role.label}`}</b> to create, edit, and delete
                invites to the {config.text.domain.base_lc}.
              </>
            }
            switchProps={form.getInputProps(
              `domain_permissions.${role.id}.can_manage_invites`,
              { type: 'checkbox' },
            )}
            disabled={!_perms.can_manage_invites}
          />

          <PermissionSetting
            title='Manage Extensions'
            description={
              <>
                Allows <b>{`@${role.label}`}</b> to add and manage the
                extensions of this {config.text.domain.base_lc}.
              </>
            }
            switchProps={form.getInputProps(
              `domain_permissions.${role.id}.can_manage_extensions`,
              { type: 'checkbox' },
            )}
            disabled={!_perms.can_manage_extensions}
          />

          <PermissionSetting
            title='Create Groups'
            description={
              <>
                Allows <b>{`@${role.label}`}</b> to create and manage new groups
                in this {config.text.domain.base_lc}.
              </>
            }
            switchProps={form.getInputProps(
              `domain_permissions.${role.id}.can_create_groups`,
              { type: 'checkbox' },
            )}
            disabled={!_perms.can_create_groups}
          />

          <PermissionSetting
            title='Create Roles'
            description={
              <>
                Allows <b>{`@${role.label}`}</b> to create and manage new roles
                within this {config.text.domain.base_lc}. To enable more precise
                role management capabilities, assign <b>{`@${role.label}`}</b>{' '}
                as a &quot;parent role&quot; to the specific roles it should
                handle.
              </>
            }
            switchProps={form.getInputProps(
              `domain_permissions.${role.id}.can_create_roles`,
              { type: 'checkbox' },
            )}
            disabled={!_perms.can_create_roles}
            withDivider={false}
          />

          <Divider maw={config.app.ui.settings_maw} mt={16} />
        </>
      )}

      {(_perms.can_set_role_permissions ||
        hasPermission(domain, role.id, 'can_manage')) && (
        <>
          <Box mb={12}>
            <Group spacing='xs' mb={4}>
              <IconFolder size={20} />
              <Title order={4}>Group Permissions</Title>
            </Group>
            <Text size='sm' color='dimmed' maw={config.app.ui.settings_maw}>
              {/* TODO : Allow channels to be clickable (to modify channel permissions) */}
              {isDefaultRole && (
                <>
                  Permissions for <b>{`@${role.label}`}</b> for every group.
                  Click a group to modify its permissions.
                </>
              )}
              {!isDefaultRole && (
                <>
                  Permission sets for groups. Users can perform any given action
                  if any of their assigned roles allow them to, which means that
                  users may have additional capabilities granted by other roles
                  even if <b>{`@${role.label}`}</b> does not explicitly allow
                  those actions.
                </>
              )}
            </Text>
          </Box>

          <DataTable
            columns={groupOverrideColumns}
            data={groupPermissionsData}
            expandableRowsComponent={GroupPermissoinsExpandableRows}
            expandableRowsProps={{ domain }}
            onRowClicked={(row) => {
              // Save changes in cache
              if (form.isDirty()) pushUnsaved(domain.id, form.values);

              // Open modal
              openChannelGroupSettings({
                domain_id: domain.id,
                group: row,
                tab: 'permissions',
                role,
              });
            }}
            emptyComponent={
              <Stack align='center' spacing='sm'>
                <Text weight={600}>
                  This role has no extra permissions for any groups
                </Text>
                <Popover position='top' withArrow>
                  {_perms.can_set_role_permissions &&
                    addableGroups.length > 0 && (
                      <Popover.Target>
                        <Button
                          variant='default'
                          leftIcon={<IconPlus size={18} />}
                        >
                          Add Permissions
                        </Button>
                      </Popover.Target>
                    )}

                  <AddGroupOverrideDropdown
                    domain={domain}
                    role={role}
                    data={addableGroups}
                  />
                </Popover>
              </Stack>
            }
            wrapperProps={{
              maw: config.app.ui.settings_maw,
            }}
          />
        </>
      )}
    </Stack>
  );
}

////////////////////////////////////////////////////////////
function MembersTab({ domain, role, session }: SubtabProps) {
  const { open: openConfirmModal } = useConfirmModal();
  const memberMutators = useMemberMutators();

  // Real time search value
  const [search, setSearch] = useState<string>('');
  // Debounced value
  const [debouncedSearch, cancelDebounced] = useDebouncedValue(search, 300);
  // Current table page number
  const [page, setPage] = useState<number>(1);

  // Can user assign this role
  const canAssign = hasPermission(domain, role.id, 'can_assign_role');

  // Member query
  const members = useMemberQuery(domain.id, {
    search: debouncedSearch,
    role_id: role.id,
    page: page - 1,
  });
  console.log('role tab', members.data);

  // Cancel debounced value if there are no more members to query
  useEffect(() => {
    if (members.count !== undefined && members.count <= 100) cancelDebounced();
  }, [search]);

  // Filtering based on search
  const filtered = useMemo(
    () =>
      members.data?.filter(
        (x) =>
          x.alias.toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) >= 0,
      ) || [],
    [members.data, search],
  );

  // Members columns
  const membersColumns = useMemo(() => {
    const cols = [
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
    ] as TableColumn<any>[];

    if (canAssign) {
      cols.push({
        name: members._exists ? (
          <AddMemberPopover
            type='table'
            domain_id={domain.id}
            role_id={role.id}
            mutators={memberMutators}
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
                title: 'Remove Member',
                confirmLabel: 'Remove',
                content: (
                  <Text>
                    Are you sure you want to remove <b>{member.alias}</b> from
                    the role <b>@{role.label}</b>?
                  </Text>
                ),
                onConfirm: () => {
                  if (!members._exists) return;
                  memberMutators.removeRole(domain.id, member.id, role.id);
                },
              });
            }}
          />
        ),
      });
    }

    return cols;
  }, [members._exists]);

  return (
    <Stack mt={20}>
      <Title order={4}>Members</Title>

      <Box>
        <TextInput
          placeholder='Search'
          icon={<IconSearch size={18} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          rightSection={
            search.length > 0 ? (
              <CloseButton onClick={() => setSearch('')} />
            ) : undefined
          }
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
            emptyComponent={
              <Stack align='center' spacing='sm'>
                <Text weight={600}>This role has no members</Text>
                <AddMemberPopover
                  type='empty'
                  domain_id={domain.id}
                  role_id={role.id}
                  mutators={memberMutators}
                />
              </Stack>
            }
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

  // Acl entries for this role
  const roleAcl = useAclEntriesByRole(role.id);

  // The current tab that is open
  const [activeTab, setActiveTab] = useCachedState<string | null>(
    `settings.${props.domain.id}.roles.tab`,
    'general',
  );

  // Used to add child roles data to form initially
  useEffect(() => {
    if (!roleAcl._exists) return;

    // Create managers map
    const map: Record<string, ChildRolePermissions> = {};
    for (const entry of roleAcl.data) {
      if (!entry.resource.startsWith('roles')) continue;

      map[entry.resource] = {
        can_manage: _hasPerm(entry?.permissions, 'can_manage'),
        can_manage_permissions: _hasPerm(
          entry?.permissions,
          'can_manage_permissions',
        ),
        can_delete_role: _hasPerm(entry?.permissions, 'can_delete_role'),
        can_assign_role: _hasPerm(entry?.permissions, 'can_assign_role'),
        can_manage_member_alias: _hasPerm(
          entry?.permissions,
          'can_manage_member_alias',
        ),
        can_manage_member_roles: _hasPerm(
          entry?.permissions,
          'can_manage_member_roles',
        ),
        can_kick_member: _hasPerm(entry?.permissions, 'can_kick_member'),
        can_ban_member: _hasPerm(entry?.permissions, 'can_ban_member'),
      };
    }

    // Add managers to initial state
    props.addChildRoles(role.id, map);
  }, [roleAcl._exists]);

  // Check if user can manage non-role resources, if user can manage role, they can view all role's permissions, even if they can't change it
  const canManageResources = useMemo(() => {
    // Have to be able to manage permissions for this role, or be able to manage domain
    if (
      !hasPermission(props.domain, role.id, 'can_manage') &&
      !hasPermission(props.domain, role.id, 'can_manage_permissions') &&
      !hasPermission(props.domain, props.domain.id, 'can_manage')
    )
      return false;

    // Check if user can manage any resources
    let manage =
      props.domain._permissions.is_admin ||
      hasPermission(props.domain, role.id, 'can_manage');
    for (const entry of props.domain._permissions.entries) {
      if (entry.resource.startsWith('roles')) continue;
      manage =
        manage || entry.permissions.findIndex((x) => x === 'can_manage') >= 0;
    }

    return manage;
  }, [props.domain._permissions.entries, role.id]);

  // Check if user can manage role
  const canManageRoles = useMemo(() => {
    // Have to be able to manage permissions for this role, if user can manage parent role, they can view all role's permissions, even if they can't change it
    if (
      !hasPermission(props.domain, role.id, 'can_manage') &&
      !hasPermission(props.domain, role.id, 'can_manage_permissions')
    )
      return false;

    // Check if user can manage any roles
    let manage =
      props.domain._permissions.is_admin ||
      hasPermission(props.domain, role.id, 'can_manage');
    for (const entry of props.domain._permissions.entries) {
      if (!entry.resource.startsWith('roles')) continue;
      manage =
        manage || entry.permissions.findIndex((x) => x === 'can_manage') >= 0;
    }

    return manage;
  }, [props.domain._permissions, role.id]);

  return (
    <Tabs
      value={activeTab}
      onTabChange={setActiveTab}
      variant='outline'
      keepMounted={false}
    >
      <Tabs.List>
        <Tabs.Tab value='general'>General</Tabs.Tab>
        {canManageResources && (
          <Tabs.Tab value='permissions'>Permissions</Tabs.Tab>
        )}
        {canManageRoles && <Tabs.Tab value='child-roles'>Child Roles</Tabs.Tab>}
        <Tabs.Tab value='members'>Members</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value='general'>
        <GeneralTab {...props} role={role} />
      </Tabs.Panel>

      {roleAcl._exists && canManageResources && (
        <Tabs.Panel value='permissions'>
          <PermissionsTab {...props} role={role} roleAcl={roleAcl} />
        </Tabs.Panel>
      )}

      {roleAcl._exists && canManageRoles && (
        <Tabs.Panel value='child-roles'>
          <ChildRolesTab {...props} role={role} roleAcl={roleAcl} />
        </Tabs.Panel>
      )}

      <Tabs.Panel value='members'>
        <MembersTab {...props} role={role} />
      </Tabs.Panel>
    </Tabs>
  );
}

////////////////////////////////////////////////////////////
export function RolesTab({ ...props }: TabProps) {
  const { mutate } = useSWRConfig();

  const session = useSession();
  const domain = useDomain(props.domain.id);
  assert(domain._exists);

  // Domain permissions
  const aclEntries = useAclEntries(domain.id);
  // List of manager maps per role
  const [childRoles, setChildRoles] = useState<
    Record<string, Record<string, ChildRolePermissions>>
  >({});

  // New role loading
  const [newRoleLoading, setNewRoleLoading] = useState<boolean>(false);

  // Settings form
  const initialValues = useMemo(() => {
    // Roles
    const roles = domain.roles.map((role) => ({
      ...role,
      badge: role.badge || null,
      show_badge: role.show_badge === undefined ? true : role.show_badge,
    }));

    // Map of domain permissions per role
    const domainPermissions: RoleFormValues['domain_permissions'] = {};

    for (const role of domain.roles) {
      const entry = aclEntries.data?.find((x) => x.role === role.id);
      domainPermissions[role.id] = {
        can_manage: _hasPerm(entry?.permissions, 'can_manage'),
        can_manage_invites: _hasPerm(entry?.permissions, 'can_manage_invites'),
        can_manage_resources: _hasPerm(
          entry?.permissions,
          'can_manage_resources',
        ),
        can_manage_extensions: _hasPerm(
          entry?.permissions,
          'can_manage_extensions',
        ),
        can_create_groups: _hasPerm(entry?.permissions, 'can_create_groups'),
        can_create_roles: _hasPerm(entry?.permissions, 'can_create_roles'),
      };
    }

    return {
      roles,
      domain_permissions: domainPermissions,
      child_roles: childRoles,
    } as RoleFormValues;
  }, [aclEntries.data, domain.roles, childRoles]);
  const form = useForm({ initialValues });

  // Role search text
  const [search, setSearch] = useState<string>('');
  // Chosen role
  const [selectedRoleId, setSelectedRoleId] = useCachedState<string | null>(
    `settings.${domain.id}.roles.selected`,
    null,
  );

  // Filtered roles
  const filteredRoles = useMemo(() => {
    if (search.length === 0) return form.values.roles;

    const query = search.toLowerCase();
    return form.values.roles.filter(
      (x) => x.label.toLowerCase().indexOf(query) >= 0,
    );
  }, [form.values.roles, search]);

  // Index of role
  const selectedIdx = useMemo(() => {
    if (!selectedRoleId) return null;
    return form.values.roles.findIndex((x) => x.id === selectedRoleId);
  }, [selectedRoleId, form.values.roles]);

  // Role obj for convenience
  const role =
    selectedIdx !== null && selectedIdx >= 0
      ? form.values.roles[selectedIdx]
      : null;

  return (
    <>
      <Text size='sm' color='dimmed' maw='100ch'>
        Roles are labels that can be assigned to members to indicate their
        designated position or responsibilities. Each role has a customizable
        set of permissions for precise control over their actions and access
        levels.
      </Text>

      <Box>
        <Title order={3}>Roles</Title>
        <Text size='sm' color='dimmed'>
          Role tags and badges will be displayed in the order they appear in
          this list.
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
            rightSection={
              search.length > 0 ? (
                <CloseButton onClick={() => setSearch('')} />
              ) : undefined
            }
            style={{ flexGrow: 1 }}
          />

          {hasPermission(domain, domain.id, 'can_create_roles') && (
            <Button
              variant='gradient'
              loading={newRoleLoading}
              onClick={async () => {
                try {
                  setNewRoleLoading(true);

                  // Create new role
                  const newDomain = await domain._mutators.addRole('New Role');

                  if (newDomain) {
                    // Find the role id that doesn't belong
                    const oldRoles = new Set<string>(
                      form.values.roles.map((x) => x.id),
                    );

                    // Switch to it
                    for (const role of newDomain.roles) {
                      if (!oldRoles.has(role.id)) {
                        setSelectedRoleId(role.id);
                        break;
                      }
                    }
                  }
                } finally {
                  setNewRoleLoading(false);
                }
              }}
            >
              New Role
            </Button>
          )}
        </Group>

        <DragDropContext
          onDragEnd={(result) => {
            if (!result.destination) return;
            const from = result.source.index;
            const to = result.destination.index;

            const copy = form.values.roles.slice();
            const role = copy.splice(from, 1)[0];
            copy.splice(to, 0, role);

            form.setFieldValue('roles', copy);
          }}
        >
          <Droppable droppableId={domain.id}>
            {(provided) => (
              <Stack
                ref={provided.innerRef}
                spacing={0}
                maw={config.app.ui.settings_maw}
                sx={(theme) => ({
                  padding: '0.5rem',
                  background: theme.other.elements.settings_panel,
                  color: theme.other.elements.settings_panel_text,
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
                            background:
                              selectedRoleId === role.id || snapshot.isDragging
                                ? theme.other.elements.settings_panel_hover
                                : undefined,
                            boxShadow: snapshot.isDragging
                              ? '0px 0px 10px #00000033'
                              : undefined,
                            borderRadius: theme.radius.sm,

                            '&:hover': {
                              background:
                                theme.other.elements.settings_panel_hover,
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
                          <Group
                            spacing='xs'
                            sx={(theme) => ({
                              '.tabler-icon': {
                                color:
                                  theme.other.elements.settings_panel_dimmed,
                              },
                            })}
                          >
                            <div style={{ height: '1.5rem' }}>
                              {role.badge ? (
                                <Emoji id={role.badge} size='1rem' />
                              ) : (
                                <IconBadgeOff
                                  size={19}
                                  style={{ marginTop: 2 }}
                                />
                              )}
                            </div>
                            <Text inline size='sm' weight={600}>
                              {role.label}
                            </Text>

                            {role.badge && !role.show_badge && (
                              <>
                                <div style={{ flexGrow: 1 }} />
                                <IconEyeOff size={20} />
                              </>
                            )}
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

      {aclEntries._exists && role && selectedIdx !== null && (
        <>
          <Divider />
          <Title order={3} mb={8}>
            Edit - {role?.badge && <Emoji id={role.badge} />} {'@'}
            {role?.label}
          </Title>

          <RoleSettingsTabs
            key={selectedRoleId}
            domain={domain}
            domainAcl={aclEntries}
            roleIdx={selectedIdx}
            form={form}
            addChildRoles={(role_id, newRoles) => {
              setChildRoles({ ...childRoles, [role_id]: newRoles });
            }}
            setSelectedRoleId={setSelectedRoleId}
            session={props.session}
          />
        </>
      )}

      <SettingsModal.Unsaved
        cacheKey={domain.id}
        form={form}
        initialValues={initialValues}
        onReset={(init) => {
          // Go to empty role if current role does not exist after reset
          if (
            selectedRoleId &&
            initialValues.roles.findIndex((x) => x.id === selectedRoleId) < 0
          )
            setSelectedRoleId(null);
        }}
        onSave={async () => {
          // Recreate original roles
          const original: Record<string, Role> = {};
          for (const role of initialValues.roles) original[role.id] = role;

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
              };
            }

            // Add diff it role changed
            else {
              const roleDiff = diff(original[role.id], role);

              // Record diff
              if (roleDiff !== undefined) changes[role.id] = roleDiff;

              // Mark as accounted for
              unaccounted.delete(role.id);

              // Check if order changed,
              if (
                i >= initialValues.roles.length ||
                role.id !== initialValues.roles[i].id
              )
                orderChanged = true;
            }
          }

          // This function does not handle deleting roles

          // The remaining values in unaccounted are deleted
          if (
            Object.keys(changes).length > 0 ||
            Object.keys(newRoles).length > 0 ||
            orderChanged
          ) {
            await domain._mutators
              .updateRoles({
                changed: changes,
                order: orderChanged
                  ? form.values.roles.map((x) => x.id)
                  : undefined,
              })
              .catch(() => {});
          }

          // List of all permission entry updates
          const entryUpdates: Omit<AclEntry, 'domain'>[] = [];

          // Set child role permissions if changed
          const childPermsDiff = diff(
            initialValues.child_roles,
            form.values.child_roles,
          );
          if (childPermsDiff && Object.keys(childPermsDiff).length > 0) {
            // Update child roles bc domain updates with new permission values, and need to set latest child roles version
            setChildRoles(form.values.child_roles);

            // Iterate roles and apply acl entries for each child role within each role
            for (const [parent_id, childRoles] of Object.entries(
              childPermsDiff,
            )) {
              if (!childRoles || Object.keys(childRoles).length === 0) continue;

              // Get permissions list for each one that changed (map of parent id to child permission changes), and add it to list of entry updates
              for (const child_id of Object.keys(childRoles || {})) {
                const permissions = Object.entries(
                  form.values.child_roles[parent_id][child_id] || {},
                )
                  .filter(([k, v]) => v)
                  .map((x) => x[0])
                  .sort() as AllPermissions[];
                entryUpdates.push({
                  resource: child_id,
                  role: parent_id,
                  permissions,
                });
              }
            }
          }

          // Set domain permissions if changed
          const domainPermsDiff = diff(
            initialValues.domain_permissions,
            form.values.domain_permissions,
          );
          if (
            aclEntries._exists &&
            domainPermsDiff &&
            Object.keys(domainPermsDiff).length > 0
          ) {
            // Get permissions list for each one that changed
            for (const role_id of Object.keys(domainPermsDiff || {})) {
              const permissions = Object.entries(
                form.values.domain_permissions[role_id],
              )
                .filter(([k, v]) => v)
                .map((x) => x[0])
                .sort() as AllPermissions[];
              entryUpdates.push({
                resource: domain.id,
                role: role_id,
                permissions,
              });
            }
          }

          // Update user permissions
          if (entryUpdates.length > 0) {
            // Update acl entries
            setAclEntries(domain.id, entryUpdates, session, mutate);

            // Update personal permission entries
            await domain._refresh();
          }
        }}
      />
    </>
  );
}
