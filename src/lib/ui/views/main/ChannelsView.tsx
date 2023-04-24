import { MouseEventHandler, useContext, useState } from 'react';

import {
  ActionIcon,
  Group,
  Menu,
  ScrollArea,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { openConfirmModal } from '@mantine/modals'

import {
  Bell,
  DotsVertical,
  Pencil,
  Settings,
  Trash,
} from 'tabler-icons-react';

import ChannelIcon from '@/lib/ui/components/ChannelIcon';

import { DomainWrapper, useApp } from '@/lib/hooks';
import { Channel } from '@/lib/types';


////////////////////////////////////////////////////////////
type SingleChannelProps = {
  channel: Channel;
  domain: DomainWrapper;
  selected: boolean;
  onClick: () => unknown;
}

////////////////////////////////////////////////////////////
function SingleChannel(props: SingleChannelProps) {
  const [showMenu, setShowMenu] = useState<boolean>(false);

  return (
    <UnstyledButton
      sx={(theme) => ({
        display: 'block',
        width: '100%',
        padding: '0.2rem 0.3rem 0.2rem 0.5rem',
        borderRadius: theme.radius.sm,
        backgroundColor: props.selected ? '#dadaff15' : undefined,
        transition: 'background-color 0.1s',
        '&:hover': {
          backgroundColor: '#dadaff15',
        },
      })}
      onClick={props.onClick}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      <Group spacing='xs' align='center'>
        <ChannelIcon type={props.channel.type} size={17} />
        <Text
          size='sm'
          weight={600}
          sx={{ flexGrow: 1 }}
        >
          {props.channel.name}
        </Text>
        <Menu
          width={180}
          withinPortal
        >
          <Menu.Target>
            <ActionIcon
              sx={(theme) => ({
                visibility: showMenu ? 'visible' : 'hidden',
                '&:hover': {
                  backgroundColor: theme.colors.dark[4]
                },
              })}
              onClick={((e) => {
                e.stopPropagation();
              }) as MouseEventHandler<HTMLButtonElement>}
            >
              <DotsVertical size={16} />
            </ActionIcon>
          </Menu.Target>

          <Menu.Dropdown
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
            }}>
            <Menu.Label>{props.channel.name.toUpperCase()}</Menu.Label>
            <Menu.Item icon={<Settings size={16} />}>Settings</Menu.Item>
            <Menu.Item icon={<Bell size={16} />}>Notifications</Menu.Item>
            <Menu.Item icon={<Pencil size={16} />}>Rename</Menu.Item>

            <Menu.Divider />
            <Menu.Item
              color='red'
              icon={<Trash size={16} />}
              onClick={() => {
                openConfirmModal({
                  title: 'Delete Channel',
                  labels: { cancel: 'Cancel', confirm: 'Delete' },
                  children: (
                    <p>
                      Are you sure you want to delete <b>{props.channel.name}</b>?
                    </p>
                  ),
                  groupProps: {
                    spacing: 'xs',
                    sx: { marginTop: '0.5rem' },
                  },
                  confirmProps: {
                    sx: (theme) => ({
                      backgroundColor: theme.colors.red[6],
                      '&:hover': { backgroundColor: theme.colors.red[7] }
                    }),
                  },
                  onConfirm: () => {
                    props.domain._mutators.removeChannel(props.channel.id);
                  }
                })
              }}
            >
              Delete channel
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </UnstyledButton>
  );
}


////////////////////////////////////////////////////////////
type ChannelsViewProps = {
  domain: DomainWrapper;
  channel_id: string;
}

////////////////////////////////////////////////////////////
export default function ChannelsView(props: ChannelsViewProps) {
  const app = useApp();

  return (
    <ScrollArea>
      {props.domain.channels?.map((channel, i) => (
        <SingleChannel
          channel={channel}
          domain={props.domain}
          selected={props.channel_id === channel.id}
          onClick={() => {
            if (props.domain._exists)
              app._mutators.navigation.setChannel(channel.id);
          }}
        />
      ))}
    </ScrollArea>
  );
}