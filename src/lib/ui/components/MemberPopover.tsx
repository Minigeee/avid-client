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
  SimpleGrid,
  Stack,
  Text,
  TextInput,
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
  useApp,
  useMemberMutators,
  usePrivateChannels,
  useProfile,
  useSession,
} from '@/lib/hooks';

import moment from 'moment';
import {
  IconBadgeOff,
  IconCake,
  IconMessage2,
  IconPlus,
  IconUser,
} from '@tabler/icons-react';
import RichTextEditor from './rte/RichTextEditor';
import ActionButton from './ActionButton';
import assert from 'assert';

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

  const app = useApp();
  const session = useSession();
  const dms = usePrivateChannels();

  const profile = useProfile(member.id);
  const memberMutators = useMemberMutators();

  const badges = useRoleBadges(props.domain);

  // Map to display roles list
  const roleMap = useMemo(() => {
    if (!props.domain) return {};

    const map: Record<string, Role> = {};
    for (const role of props.domain.roles) map[role.id] = role;
    return map;
  }, [props.domain?.roles]);

  // Check if user can manage member
  const canManageMember = useMemo(
    () => props.domain ? hasMemberPermission(props.domain, member, 'can_manage_member_roles') : false,
    [props.domain, member],
  );

  // List of addable roles
  const addableRoles = useMemo(() => {
    if (!props.domain) return [];

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
  }, [props.domain?.roles, member.roles]);

  // Check if user can message this member
  const canMessage = profile.id !== session.profile_id;

  return (
    <>
      <Group
        mih='6rem'
        sx={(theme) => ({
          background: theme.other.elements.profile_banner,
        })}
      />

      <Stack
        p='1.0rem 1.25rem'
        spacing='lg'
        sx={(theme) => ({
          borderBottom: `1px solid ${theme.other.colors.page_border}`,
        })}
      >
        <Group spacing='sm'>
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
            <Group spacing={6}>
              <Title
                order={5}
                sx={(theme) => ({ color: theme.other.elements.member_name })}
              >
                {member.alias}
              </Title>
              {member.roles && (
                <RoleBadges badges={badges} role_ids={member.roles} />
              )}
            </Group>

            {canMessage && (
              <Group mt={2}>
                <ActionButton
                  tooltip='Send Message'
                  size='xs'
                  variant='transparent'
                  onClick={() => {
                    if (!dms._exists || !profile._exists) return;

                    // Check if private channel exists
                    const privChannel = dms.data.find(
                      (x) =>
                        !x.multi_member &&
                        x.members.findIndex((y) => y === member.id) >= 0,
                    );

                    // If private channel exists, switch to it
                    if (privChannel) {
                      app._mutators.setPrivateChannel(privChannel.id);
                    } else {
                      // Otherwise, switch to new channel screen
                      app._mutators.setView('dm');
                      app._mutators.setNewPrivateChannel(profile);
                    }
                  }}
                >
                  <IconMessage2 size={16} />
                </ActionButton>
              </Group>
            )}
          </Box>
        </Group>

        <Group spacing='xl'>
          <Box>
            <Group mb={2} spacing={8} noWrap>
              <IconUser size={16} />
              <Title order={6}>Member Since</Title>
            </Group>
            <Text size='sm'>{moment(member.time_joined).format('LL')}</Text>
          </Box>

          {profile._exists && (
            <Box>
              <Group mb={2} spacing={8} noWrap>
                <IconCake size={16} />
                <Title order={6}>Profile Created</Title>
              </Group>
              <Text size='sm'>{moment(profile.time_created).format('LL')}</Text>
            </Box>
          )}
        </Group>
      </Stack>

      {props.domain && (
        <Box p='1.0rem 1.25rem' mb={4}>
          <Title order={6} mb={2}>
            Roles
          </Title>
          <Group spacing={6}>
            {member.roles?.map((id) => {
              assert(props.domain);

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
                            onConfirm: () => {
                              assert(props.domain);
                              memberMutators.removeRole(
                                props.domain.id,
                                member.id,
                                id,
                              );
                            },
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
                  assert(props.domain);

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
      )}
    </>
  );
}

////////////////////////////////////////////////////////////
export type MemberPopoverProps = PropsWithChildren & {
  domain: DomainWrapper | undefined;
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
      width='22rem'
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
          overflow: 'hidden',
        })}
      >
        <Dropdown {...props} />
      </Popover.Dropdown>
    </Popover>
  );
}
