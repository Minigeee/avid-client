import { PropsWithChildren } from 'react';

import {
  Menu, Text
} from '@mantine/core';
import { IconBell, IconPencil, IconSettings, IconTrash } from '@tabler/icons-react';

import { openChannelGroupSettings, openChannelSettings } from '@/lib/ui/modals';
import { useConfirmModal } from '@/lib/ui/modals/ConfirmModal';

import { Channel, ChannelGroup } from '@/lib/types';
import { DomainWrapper, hasPermission } from '@/lib/hooks';
import { ContextMenu } from '@/lib/ui/components/ContextMenu';


////////////////////////////////////////////////////////////
export type ChannelMenuContext = {
  /** Channel to show context menu for */
  channel: Channel;

  /** Called when rename option is clicked */
  onRename?: () => void;
};

////////////////////////////////////////////////////////////
export type ChannelGroupMenuContext = {
  /** Channel group to show context menu for */
  group: ChannelGroup;

  /** Called when rename option is clicked */
  onRename?: () => void;
};

////////////////////////////////////////////////////////////
export type ChannelsViewMenuProps = PropsWithChildren & {
  /** Domain the channels belong to */
  domain: DomainWrapper;
};


////////////////////////////////////////////////////////////
type ChannelMenuDropdownProps = Omit<ChannelsViewMenuProps, 'children'> &
  ChannelMenuContext;

////////////////////////////////////////////////////////////
export function ChannelMenuDropdown(props: ChannelMenuDropdownProps) {
  const { open: openConfirmModal } = useConfirmModal();
  
  const canEdit =
    hasPermission(props.domain, props.channel.id, 'can_manage_resources') ||
    hasPermission(props.domain, props.channel.id, 'can_manage');

  return (
    <>
      <Menu.Label>{props.channel.name.toUpperCase()}</Menu.Label>
      {canEdit && (
        <Menu.Item
          icon={<IconSettings size={16} />}
          disabled={props.channel.type !== 'board'}
          onClick={() =>
            openChannelSettings({
              domain_id: props.domain.id,
              channel: props.channel,
            })
          }
        >
          Settings
        </Menu.Item>
      )}

      <Menu.Item icon={<IconBell size={16} />} disabled>
        Notifications
      </Menu.Item>

      {canEdit && props.onRename && (
        <Menu.Item
          icon={<IconPencil size={16} />}
          onClick={props.onRename}
        >
          Rename
        </Menu.Item>
      )}

      {hasPermission(
        props.domain,
        props.channel.id,
        'can_manage_resources',
      ) && (
        <>
          <Menu.Divider />
          <Menu.Item
            color='red'
            icon={<IconTrash size={16} />}
            onClick={() => {
              openConfirmModal({
                title: 'Delete Page',
                content: (
                  <Text>
                    Are you sure you want to delete <b>{props.channel.name}</b>?
                  </Text>
                ),
                confirmLabel: 'Delete',
                onConfirm: () => {
                  props.domain._mutators.removeChannel(props.channel.id);
                },
              });
            }}
          >
            Delete page
          </Menu.Item>
        </>
      )}
    </>
  );
}


////////////////////////////////////////////////////////////
type ChannelGroupMenuDropdownProps = Omit<ChannelsViewMenuProps, 'children'> &
  ChannelGroupMenuContext;

////////////////////////////////////////////////////////////
export function ChannelGroupMenuDropdown(props: ChannelGroupMenuDropdownProps) {
  const { open: openConfirmModal } = useConfirmModal();

  return (
    <>
      <Menu.Label>{props.group.name.toUpperCase()}</Menu.Label>
      <Menu.Item
        icon={<IconSettings size={16} />}
        onClick={() => {
          openChannelGroupSettings({
            domain_id: props.domain.id,
            group: props.group,
          });
        }}
      >
        Settings
      </Menu.Item>

      {props.onRename && hasPermission(props.domain, props.group.id, 'can_manage') && (
        <Menu.Item
          icon={<IconPencil size={16} />}
          onClick={props.onRename}
        >
          Rename
        </Menu.Item>
      )}

      {hasPermission(props.domain, props.group.id, 'can_delete_group') && (
        <>
          <Menu.Divider />
          <Menu.Item
            color='red'
            icon={<IconTrash size={16} />}
            onClick={() => {
              openConfirmModal({
                title: 'Delete Group',
                modalProps: {
                  yOffset: `${Math.max(
                    30 - props.group.channels.length * 0.6,
                    1,
                  )}vh`,
                },
                content: (
                  <>
                    <p style={{ marginBlockEnd: 0 }}>
                      Are you sure you want to delete <b>{props.group.name}</b>{' '}
                      and the following pages?
                    </p>
                    <ul
                      style={{
                        marginBlockStart: 0,
                        marginBlockEnd: 0,
                      }}
                    >
                      {props.group.channels.map((channel_id) => (
                        <li key={channel_id}>
                          <b>{props.domain.channels[channel_id].name}</b>
                        </li>
                      ))}
                    </ul>
                  </>
                ),
                confirmLabel: 'Delete',
                typeToConfirm:
                  props.group.channels.length > 2
                    ? props.group.name
                    : undefined,
                confirmText: (
                  <>
                    Please type <b>{props.group.name}</b> to confirm this
                    action.
                  </>
                ),
                onConfirm: () => {
                  props.domain._mutators.removeGroup(props.group.id);
                },
              });
            }}
          >
            Delete group
          </Menu.Item>
        </>
      )}
    </>
  );
}


////////////////////////////////////////////////////////////
export function ChannelsViewContextMenu(props: ChannelsViewMenuProps) {
  return (
    <ContextMenu width='14rem'>
      <ContextMenu.Dropdown dependencies={[props.domain]}>
        {(context: ChannelMenuContext & ChannelGroupMenuContext & { type: 'channel' | 'group' }) => (
          <>
            {context.type === 'channel' && (<ChannelMenuDropdown domain={props.domain} {...context} />)}
            {context.type === 'group' && (<ChannelGroupMenuDropdown domain={props.domain} {...context} />)}
          </>
        )}
      </ContextMenu.Dropdown>

      {props.children}
    </ContextMenu>
  );
}

