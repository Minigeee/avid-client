import { AppProps } from 'next/app';
import Head from 'next/head';
import { SWRConfig } from 'swr';

import { MantineProvider, ScrollArea } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';

import { modals } from '@/lib/ui/modals';

import config from '@/config';
import SessionProvider from '@/lib/contexts/session';
import { swrHandler } from '@/lib/utility/error-handler';
import { DatesProvider } from '@mantine/dates';


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
            colorScheme: 'dark',
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
                '#111519'
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

            components: {
              DatePickerInput: {
                styles: (theme) => ({
                  day: {
                    '&[data-today="true"]:not([data-selected="true"])': {
                      backgroundColor: theme.colors.dark[4],
                      '&:hover': { backgroundColor: theme.colors.dark[3] }
                    },
                    '&[data-weekend="true"]': {
                      color: theme.colors.dark[2],
                      fontWeight: 700,
                    },
                    '&[data-weekend="true"][data-selected="true"]': {
                      color: theme.colors.dark[0],
                    },
                  },
                }),
              },

              Input: {
                styles: (theme) => ({
                  wrapper: {
                    marginTop: 5,
                  },
                }),
              },

              InputWrapper: {
                styles: (theme) => ({
                  description: {
                    marginTop: 1,
                    marginBottom: 10,
                  },
                }),
              },

              MultiSelect: {
                styles: (theme) => ({
                  dropdown: {
                    boxShadow: '0px 2px 10px #00000022',
                  },
                  item: {
                    '&[data-hovered]': {
                      background: `linear-gradient(to right, ${theme.colors.dark[3]} 4px, ${theme.colors.dark[5]} 0)`,
                    },
                  },
                }),
              },

              Select: {
                styles: (theme) => ({
                  dropdown: {
                    boxShadow: '0px 2px 10px #00000022',
                  },
                  item: {
                    '&[data-hovered]': {
                      background: `linear-gradient(to right, ${theme.colors.dark[3]} 4px, ${theme.colors.dark[5]} 0)`,
                    },
                    '&[data-selected]': {
                      background: `linear-gradient(to right, ${theme.colors.indigo[5]} 4px, ${theme.colors.dark[4]} 0)`,
                    },
                  },
                }),
              },

              Slider: {
                styles: (theme) => ({
                  trackContainer: { cursor: 'default' },
                }),
              },

              Tooltip: {
                styles: (theme) => ({
                  tooltip: {
                    backgroundColor: theme.colors.dark[9],
                    color: theme.colors.dark[0],
                  },
                }),
              },
            }
          }}
        >
          <Notifications position='top-right' />
          <SWRConfig value={{
            onError: swrHandler,
            dedupingInterval: config.swr.dedupe_interval * 1000,
            focusThrottleInterval: config.swr.focus_throttle_interval * 1000,
          }}>
            <DatesProvider settings={{ firstDayOfWeek: 0 }}>
              <ModalsProvider modals={modals} modalProps={{ scrollAreaComponent: ScrollArea.Autosize }}>
                <Component {...pageProps} />
              </ModalsProvider>
            </DatesProvider>
          </SWRConfig>
        </MantineProvider>
      </SessionProvider>
    </>
  );
}