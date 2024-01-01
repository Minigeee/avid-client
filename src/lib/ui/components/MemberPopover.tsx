import { PropsWithChildren, forwardRef, useMemo } from 'react';

import {
  ActionIcon,
  Box,
  CloseButton,
  Divider,
  Group,
  Indicator,
  Popover,
  PopoverProps,
  Stack,
  Text,
  Title,
  Tooltip,
  TooltipProps,
} from '@mantine/core';

import { Emoji } from './Emoji';
import MemberAvatar from './MemberAvatar';
import RoleBadges, { useRoleBadges } from './RoleBadges';
import PopoverSelect from './PopoverSelect';
import { useConfirmModal } from '@/lib/ui/modals/ConfirmModal';

import { ExpandedMember, Role } from '@/lib/types';
import {
  DomainWrapper,
  hasMemberPermission,
  hasPermission,
  useMemberMutators,
  useProfile,
} from '@/lib/hooks';

import moment from 'moment';
import {
  IconBadgeOff,
  IconCake,
  IconPlus,
  IconUser,
} from '@tabler/icons-react';

////////////////////////////////////////////////////////////
const RoleSelectItem = forwardRef<HTMLDivElement, Role>(
  ({ label, badge, ...others }, ref) => (
    <div ref={ref} {...others}>
      <Group spacing='xs' noWrap>
        {badge ? (
          <Box
            h='1.5rem'
            sx={(theme) => ({ color: theme.other.colors.page_dimmed })}
          >
            <Emoji id={badge} size='1rem' />
          </Box>
        ) : (
          <Box
            h='1.5rem'
            pt={2}
            sx={(theme) => ({ color: theme.other.colors.page_dimmed })}
          >
            <IconBadgeOff size={19} />
          </Box>
        )}
        <Text size='sm'>{label}</Text>
      </Group>
    </div>
  ),
);
RoleSelectItem.displayName = 'RoleSelectItem';

////////////////////////////////////////////////////////////
function Dropdown({ member, ...props }: MemberPopoverProps) {
  const { open: openConfirmModal } = useConfirmModal();

  const profile = useProfile(member.id);
  const memberMutators = useMemberMutators();

  const badges = useRoleBadges(props.domain);

  // Map to display roles list
  const roleMap = useMemo(() => {
    const map: Record<string, Role> = {};
    for (const role of props.domain.roles) map[role.id] = role;
    return map;
  }, [props.domain.roles]);

  // Check if user can manage member
  const canManageMember = useMemo(
    () => hasMemberPermission(props.domain, member, 'can_manage_member_roles'),
    [props.domain, member],
  );

  // List of addable roles
  const addableRoles = useMemo(() => {
    // Set of already added roles
    const added = new Set(member.roles);
    const addable: Role[] = [];

    for (const role of props.domain.roles) {
      if (
        !added.has(role.id) &&
        (canManageMember ||
          hasPermission(props.domain, role.id, 'can_assign_role'))
      )
        addable.push(role);
    }

    return addable;
  }, [props.domain.roles, member.roles]);

  return (
    <>
      <Group
        spacing='sm'
        p='1.0rem 1.25rem'
        sx={(theme) => ({
          borderBottom: `1px solid ${theme.other.colors.page_border}`,
        })}
      >
        <Indicator
          inline
          position='bottom-end'
          offset={6}
          size={12}
          color='teal'
          withBorder
          disabled={!member.online}
        >
          <MemberAvatar member={member} size={48} />
        </Indicator>

        <Box>
          <Title
            order={5}
            sx={(theme) => ({ color: theme.other.elements.member_name })}
          >
            {member.alias}
          </Title>
          {member.roles && (
            <RoleBadges badges={badges} role_ids={member.roles} />
          )}
        </Box>
      </Group>

      <Stack p='1.0rem 1.25rem' spacing='sm'>
        <Box>
          <Group mb={2} spacing={8}>
            <IconUser size={16} />
            <Title order={6}>Member Since</Title>
          </Group>
          <Text size='sm'>{moment(member.time_joined).format('LL')}</Text>
        </Box>

        {profile._exists && (
          <Box>
            <Group mb={2} spacing={8}>
              <IconCake size={16} />
              <Title order={6}>Profile Created</Title>
            </Group>
            <Text size='sm'>{moment(profile.time_created).format('LL')}</Text>
          </Box>
        )}

        <Divider
          sx={(theme) => ({ borderColor: theme.other.colors.page_border })}
        />

        <Box mb={4}>
          <Title order={6} mb={2}>
            Roles
          </Title>
          <Group spacing={6}>
            {member.roles?.map((id) => {
              const role = roleMap[id];
              const canManageRole =
                canManageMember ||
                hasPermission(props.domain, id, 'can_assign_role');

              return (
                <Box
                  key={id}
                  h={24}
                  sx={(theme) => ({
                    padding: `0px ${
                      canManageRole ? '0.3rem' : '0.6rem'
                    } 0 0.5rem`,
                    background: theme.other.colors.panel,
                    borderRadius: 15,
                  })}
                >
                  <Group spacing={4} align='center' h='100%' mt={-1}>
                    {role.badge && <Emoji id={role.badge} size={12} />}
                    <Text size='xs' weight={500}>
                      {role.label}
                    </Text>
                    {canManageRole && (
                      <CloseButton
                        size={16}
                        iconSize={14}
                        variant='transparent'
                        tabIndex={-1}
                        mt={2}
                        onClick={() =>
                          openConfirmModal({
                            title: 'Remove Role',
                            content: (
                              <Text>
                                Are you sure you want to remove the{' '}
                                <b>{role.label}</b> role from{' '}
                                <b>{member.alias}</b>?
                              </Text>
                            ),
                            confirmLabel: 'Remove',
                            onConfirm: () =>
                              memberMutators.removeRole(
                                props.domain.id,
                                member.id,
                                id,
                              ),
                          })
                        }
                      />
                    )}
                  </Group>
                </Box>
              );
            })}

            {addableRoles.length > 0 && (
              <PopoverSelect
                data={addableRoles}
                itemComponent={RoleSelectItem}
                searchProps={{ placeholder: 'Search roles' }}
                onSelect={async (item) => {
                  // Add single role
                  await memberMutators.addRoles(
                    props.domain.id,
                    [member.id],
                    item.id,
                  );
                }}
              >
                {(setOpened, opened) => (
                  <ActionIcon
                    size='sm'
                    radius='lg'
                    sx={(theme) => ({
                      background: theme.other.colors.panel,
                      '&:hover': {
                        background: theme.other.colors.panel_hover,
                      },
                    })}
                    onClick={() => setOpened(!opened)}
                  >
                    <IconPlus size={14} />
                  </ActionIcon>
                )}
              </PopoverSelect>
            )}
          </Group>
        </Box>
      </Stack>
    </>
  );
}

////////////////////////////////////////////////////////////
export type MemberPopoverProps = PropsWithChildren & {
  domain: DomainWrapper;
  member: ExpandedMember;
  popoverProps?: Partial<PopoverProps>;
  withinPortal?: boolean;
  tooltip?: string;
  tooltipProps?: Partial<TooltipProps>;
};

////////////////////////////////////////////////////////////
export default function MemberPopover(props: MemberPopoverProps) {
  return (
    <Popover
      radius='sm'
      width='18rem'
      position='bottom-start'
      zIndex={199}
      {...props.popoverProps}
      withinPortal={props.withinPortal}
    >
      <Tooltip
        {...props.tooltipProps}
        label={props.tooltip}
        disabled={props.tooltip === undefined}
      >
        <Popover.Target>{props.children}</Popover.Target>
      </Tooltip>

      <Popover.Dropdown
        sx={(theme) => ({
          padding: 0,
          border: `solid 1px ${theme.other.colors.page_border}`,
        })}
      >
        <Dropdown {...props} />
      </Popover.Dropdown>
    </Popover>
  );
}
