import { Dispatch, SetStateAction } from 'react';

import {
  ActionIcon,
  Box,
  CloseButton,
  Group,
  Menu,
  Tabs,
  Title,
  Tooltip,
  useMantineTheme,
} from '@mantine/core';

import { IconArrowBarLeft, IconArrowBarRight, IconBell, IconCalendarTime, IconFolderPlus, IconHash, IconPlus, IconUsers } from '@tabler/icons-react';

import { openCreateChannel, openCreateChannelGroup } from '@/lib/ui/modals';
import ActionButton from '@/lib/ui/components/ActionButton';
import ChannelIcon from '@/lib/ui/components/ChannelIcon';
import RtcControlBar from '@/lib/ui/components/rtc/RtcControlBar';
// TODO : import BoardHeader from './headers/BoardHeader';

import { DomainWrapper, hasPermission, useApp, useRtc } from '@/lib/hooks';
import { Channel, RightPanelTab } from '@/lib/types';
import { AppState } from '@/lib/contexts';


////////////////////////////////////////////////////////////
type RightPanelTabProps = {
  app: AppState;
  selected: RightPanelTab;
  value: RightPanelTab;
  label: string;
  icon: JSX.Element;
};

////////////////////////////////////////////////////////////
function RightPanelTabIcon(props: RightPanelTabProps) {
  return (
    <ActionButton
      tooltip={props.label}
      sx={(theme) => ({
        backgroundColor: props.selected === props.value ? theme.colors.dark[4] : undefined,
        color: theme.colors.dark[props.selected === props.value ? 0 : 1],
        transition: 'background-color 0.08s',
        '&:hover': { backgroundColor: props.selected === props.value ? theme.colors.dark[4] : theme.colors.dark[5] },
      })}
      onClick={() => props.app._mutators.setRightPanelTab(props.value)}
    >
      {props.icon}
    </ActionButton>
  );
}


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
  const rtc = useRtc();


  // Current right panel tab
  const rpTab = app.right_panel_tab[props.domain.id] || 'members';

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
        width: '18rem',
        height: '100%',
        paddingLeft: '1.0rem',
        paddingRight: '0.3rem',
      })}>
        <Title order={5} sx={{ flexGrow: 1 }}>
          {'Channels'}
        </Title>
        <div style={{ flexGrow: 1 }} />
        {hasPermission(props.domain, props.domain.id, 'can_create_groups') && (
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

          {rtc.joined && (
            <RtcControlBar />
          )}
        </Group>
      )}
      {!props.channel && (
        <div style={{ flexGrow: 1 }} />
      )}

      {app.right_panel_opened && (
        <Group spacing={2} sx={(theme) => ({
          width: '16rem',
          height: '100%',
          paddingLeft: '0.25rem',
          paddingRight: '0.5rem',
          borderLeft: `1px solid ${theme.colors.dark[7]}`,
        })}>
          <Tabs
            value={rpTab}
            onTabChange={(value) => app._mutators.setRightPanelTab(value as RightPanelTab)}
            variant='pills'
            color='dark'
            styles={(theme) => ({
              root: {
                flexGrow: 1,
              },
              tab: {
                color: theme.colors.dark[1],
                fontWeight: 600,
                transition: 'background-color 0.1s',

                '&:hover': {
                  backgroundColor: theme.colors.dark[5],
                },
                '&[data-active]': {
                  backgroundColor: theme.colors.dark[5],
                  '&:hover': {
                    backgroundColor: theme.colors.dark[5],
                  },
                },
              },
              tabsList: {
                gap: 2,
              },
            })}
          >
            <Tabs.List>
              <Tooltip label='Members' withArrow>
                <Tabs.Tab icon={<IconUsers size={18} />} value='members' />
              </Tooltip>
              <Tooltip label='Activity' withArrow>
                <Tabs.Tab icon={<IconBell size={18} />} value='activity' disabled />
              </Tooltip>
              <Tooltip label='Upcoming' withArrow>
                <Tabs.Tab icon={<IconCalendarTime size={18} />} value='upcoming' disabled />
              </Tooltip>
            </Tabs.List>
          </Tabs>

          <CloseButton
            size='lg'
            iconSize={20}
            onClick={() => app._mutators.setRightPanelOpened(false)}
          />
        </Group>
      )}
      {!app.right_panel_opened && (
        <Group spacing={2} sx={(theme) => ({
          height: '100%',
          paddingLeft: '0.5rem',
          paddingRight: '0.5rem',
        })}>
          <ActionButton
            tooltip='Open Panel'
            onClick={() => app._mutators.setRightPanelOpened(true)}
          >
            <IconArrowBarLeft size={18} />
          </ActionButton>
        </Group>
      )}
    </Box>
  );
}
