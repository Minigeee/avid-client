import { useMemo, useState } from 'react';
import assert from 'assert';

import {
  Box,
  Flex,
} from '@mantine/core';

import ErrorBoundary from '@/lib/ui/components/ErrorBoundary';
import ChannelsView from '@/lib/ui/views/main/ChannelsView';
import HeaderView from '@/lib/ui/views/main/HeaderView';
import MessagesView from '@/lib/ui/views/chat/MessagesView';
import RoomView from '@/lib/ui/views/rtc/RoomView';
import BoardView from '@/lib/ui/views/projects/BoardView';

import { useApp, useDomain } from '@/lib/hooks';
import { Channel } from '@/lib/types';

const HEADER_HEIGHT = '2.8rem';


////////////////////////////////////////////////////////////
export default function MainView() {
  const app = useApp();
  assert(app.navigation.domain && app.navigation.domain?.startsWith('domains'));

  const domain = useDomain(app.navigation.domain);
  // Get channel, using nav state as first choice and first channel as back up
  const channel_id = app.navigation.channels?.[app.navigation.domain] ||
    (domain.channels?.length ? domain.channels[0].id : undefined);

  const [headerData, setHeaderData] = useState<Record<string, any>>({});

  // Retrieve channel object
  const channel = useMemo<Channel | undefined>(
    () => domain.channels?.find(x => x.id === channel_id),
    [channel_id, domain.channels]
  );


  if (!domain._exists)
    return null;

  return (
    <>
      <ErrorBoundary>
        <HeaderView
          domain={domain}
          channel={channel}
          height={HEADER_HEIGHT}
          data={headerData}
          setData={setHeaderData}
        />
      </ErrorBoundary>

      <Flex w='100%' h={`calc(100% - ${HEADER_HEIGHT})`}>
        <Box sx={(theme) => ({
          flexShrink: 0,
          width: '30ch',
          height: '100%',
          backgroundColor: theme.colors.dark[6],
        })}>
          <ChannelsView
            channel_id={channel_id || ''}
            domain={domain}
          />
        </Box>

        <ErrorBoundary>
          {channel && (
            <Box sx={(theme) => ({
              flexGrow: 1,
              width: 0, // idk why this works
              height: '100%',
              backgroundColor: theme.colors.dark[7],
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
          )}
        </ErrorBoundary>
      </Flex>
    </>
  )
}
