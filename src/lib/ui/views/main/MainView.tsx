import { useEffect, useMemo, useState } from 'react';
import assert from 'assert';

import {
  Box,
  Divider,
  Flex,
  Group,
  Title,
} from '@mantine/core';

import ErrorBoundary from '@/lib/ui/components/ErrorBoundary';
import ChannelsView from '@/lib/ui/views/main/ChannelsView';
import HeaderView from '@/lib/ui/views/main/HeaderView';
import MessagesView from '@/lib/ui/views/chat/MessagesView';
import RoomView from '@/lib/ui/views/rtc/RoomView';
import CalendarView from '@/lib/ui/views/calendar/CalendarView';
import BoardView from '@/lib/ui/views/projects/BoardView';

import { useApp, useDomain, useRtc } from '@/lib/hooks';
import { Channel } from '@/lib/types';
import RightPanelView from './RightPanelView';
import ChannelIcon from '../../components/ChannelIcon';
import RtcControlBar from '../../components/rtc/RtcControlBar';
import ActionButton from '../../components/ActionButton';
import { IconArrowBarLeft } from '@tabler/icons-react';

const HEADER_HEIGHT = '2.8rem';


////////////////////////////////////////////////////////////
export default function MainView() {
  const app = useApp();
  const rtc = useRtc();
  assert(app.domain && app.domain.startsWith('domains'));

  const domain = useDomain(app.domain);
  // Get channel, using nav state as first choice and first channel as back up
  const channel_id = app.channels[app.domain] ||
    (Object.keys(domain?.channels || {}).length ? Object.keys(domain?.channels || {})[0] : undefined);

  // Retrieve channel object
  const channel = channel_id ? domain?.channels?.[channel_id] || undefined : undefined;


  // Set channel remote
  useEffect(() => {
    assert(app.domain);

    if (!app.channels[app.domain] && channel_id)
      app._mutators.setChannel(channel_id);
  }, [channel_id, app.channels[app.domain]])


  if (!domain._exists)
    return null;

  return (
    <Flex sx={{
      flexGrow: 1,
      overflow: 'hidden',
      width: '100%',
      borderTopLeftRadius: 6,
      borderTopRightRadius: 6,
    }}>
      <ChannelsView
        channel_id={channel_id || ''}
        domain={domain}
      />

      <ErrorBoundary>
        {channel && (
          <Flex direction='column' sx={(theme) => ({
            flexGrow: 1,
            width: 0, // idk why this works
            height: '100%',
            backgroundColor: theme.colors.dark[7],
          })}>
            <Group
              spacing={8}
              noWrap
              sx={(theme) => ({
                flexShrink: 0,
                height: '3.0rem',
                paddingLeft: '1.0rem',
                paddingRight: '0.3rem',
                borderBottom: `1px solid ${theme.colors.dark[5]}`,
              })}
            >
              <ChannelIcon type={channel.type} size={18} />
              <Title order={5} ml={4}>
                {channel.name}
              </Title>

              <div style={{ flexGrow: 1 }} />

              {rtc.joined && (
                <>
                  <RtcControlBar />
                  {!app.right_panel_opened && <Divider orientation='vertical' m='0.5rem 0.0rem' />}
                </>
              )}

              {!app.right_panel_opened && (
                <ActionButton
                  tooltip='Open Side Panel'
                  hoverBg={(theme) => theme.colors.dark[6]}
                  mr={4}
                  onClick={() => app._mutators.setRightPanelOpened(true)}
                >
                  <IconArrowBarLeft size={18} />
                </ActionButton>
              )}
            </Group>

            <Box sx={(theme) => ({
              flexGrow: 1,
              width: '100%',
              height: 0,
            })}>
              {channel.type === 'text' && (
                <MessagesView
                  key={channel.id}
                  channel_id={channel.id}
                  domain={domain}
                />
              )}
              {channel.type === 'rtc' && (
                <RoomView
                  key={channel.id}
                  channel={channel as Channel<'rtc'>}
                  domain={domain}
                />
              )}
              {channel.type === 'calendar' && (
                <CalendarView
                  key={channel.id}
                  channel={channel}
                  domain={domain}
                />
              )}
              {channel.type === 'board' && (
                <BoardView
                  key={channel.id}
                  channel={channel as Channel<'board'>}
                  domain={domain}
                />
              )}
            </Box>
          </Flex>
        )}
      </ErrorBoundary>

      {!channel && (
        <Box sx={(theme) => ({
          flexGrow: 1,
          width: 0, // idk why this works
          height: '100%',
          backgroundColor: theme.colors.dark[7],
        })} />
      )}

      {app.right_panel_opened && (
        <RightPanelView
          key={domain.id}
          domain={domain}
        />
      )}
    </Flex>
  )
}
