import { AppProps } from 'next/app';
import Head from 'next/head';
import { SWRConfig } from 'swr';

import { MantineProvider, ScrollArea } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';

import config from '@/config';
import SessionProvider from '@/lib/contexts/session';
import { swrHandler } from '@/lib/utility/error-handler';
import { DatesProvider } from '@mantine/dates';
import { useColorScheme } from '@mantine/hooks';

export default function App(props: AppProps) {
  const { Component, pageProps } = props;

  return (
    <>
      <Head>
        <title>Avid</title>
      </Head>

      <SessionProvider>
        <MantineProvider
          withGlobalStyles
          withNormalizeCSS
          theme={{
            colors: {
              dark: [
                '#E9ECF0',
                '#BFC0C6',
                '#96999F',
                '#626771',
                '#434852',
                '#32363E',
                '#272B34',
                '#1F242A',
                '#181D23',
                '#111519',
              ],
              red: [
                '#FFF5F5',
                '#FFE3E3',
                '#FFA8A8',
                '#FF8787',
                '#FF6B6B',
                '#F95555',
                '#F03E3E',
                '#E03131',
                '#C92A2A',
                '#BA2424',
              ],
            },
            primaryColor: 'indigo',
            primaryShade: 5,
            defaultGradient: { from: 'violet', to: 'pink' },
          }}
        >
          <Notifications position='top-right' />
          <SWRConfig
            value={{
              onError: swrHandler,
              dedupingInterval: config.swr.dedupe_interval * 1000,
              focusThrottleInterval: config.swr.focus_throttle_interval * 1000,
            }}
          >
            <DatesProvider settings={{ firstDayOfWeek: 0 }}>
              <Component {...pageProps} />
            </DatesProvider>
          </SWRConfig>
        </MantineProvider>
      </SessionProvider>
    </>
  );
}
