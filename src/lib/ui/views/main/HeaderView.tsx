import { Dispatch, SetStateAction } from 'react';

import {
  ActionIcon,
  Box,
  Group,
  Menu,
  Title,
  useMantineTheme,
} from '@mantine/core';

import { IconFolderPlus, IconHash, IconPlus } from '@tabler/icons-react';

import { openCreateChannel, openCreateChannelGroup } from '@/lib/ui/modals';
import ActionButton from '@/lib/ui/components/ActionButton';
import ChannelIcon from '@/lib/ui/components/ChannelIcon';
import RtcControlBar from '@/lib/ui/components/rtc/RtcControlBar';
// TODO : import BoardHeader from './headers/BoardHeader';

import { DomainWrapper, hasPermission, useApp } from '@/lib/hooks';
import { Channel } from '@/lib/types';


////////////////////////////////////////////////////////////
type HeaderViewProps = {
  /** Domain data */
  domain: DomainWrapper;
  /** The currently selected channel */
  channel?: Channel;

  data: Record<string, any>;
  setData: Dispatch<SetStateAction<Record<string, any>>>;

  /** Height of header bar in rem */
  height: string;
}

////////////////////////////////////////////////////////////
export default function HeaderView(props: HeaderViewProps) {
  const theme = useMantineTheme();
  const app = useApp();


  return (
    <Box sx={(theme) => ({
      position: 'relative',
      display: 'flex',
      height: props.height,
      backgroundColor: theme.colors.dark[6],
      boxShadow: `0px 0px 6px ${theme.colors.dark[9]}`,
      zIndex: 3,
    })}>
      <Group sx={(theme) => ({
        width: '30ch',
        height: '100%',
        paddingLeft: '0.8rem',
        paddingRight: '0.3rem',
      })}>
        <Title order={5} sx={{ flexGrow: 1 }}>
          {'Channels'}
        </Title>
        {hasPermission(props.domain, props.domain.id, 'can_create_resources') && (
          <Menu width='12rem'>
            <Menu.Target>
              <ActionIcon>
                <IconPlus size={18} color={theme.colors.dark[1]} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Item
                icon={<IconHash size={18} />}
                onClick={() => openCreateChannel({ domain: props.domain })}
              >
                New Channel
              </Menu.Item>
              <Menu.Item
                icon={<IconFolderPlus size={18} />}
                onClick={() => openCreateChannelGroup({ domain: props.domain })}
              >
                New Group
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
      {props.channel && (
        <Group
          spacing={8}
          noWrap
          sx={(theme) => ({
            flexGrow: 1,
            height: '100%',
            paddingLeft: '0.8rem',
            paddingRight: '0.3rem',
            borderLeft: `1px solid ${theme.colors.dark[7]}`,
          })}
        >
          <ChannelIcon type={props.channel.type} size={18} />
          <Title order={5}>
            {props.channel.name}
          </Title>

          {/* TODO : props.channel.type === 'board' && <BoardHeader data={props.data} setData={props.setData} /> */}

          <div style={{ flexGrow: 1 }} />

          {app.rtc?.joined && (
            <RtcControlBar />
          )}
        </Group>
      )}
    </Box>
  );
}
