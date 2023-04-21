import { AppProps } from 'next/app';

import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';

import SessionProvider from '@/lib/contexts/session';
import { modals } from '@/lib/components/modals';


export default function App(props: AppProps) {
  const { Component, pageProps } = props;

  return (
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
              '#636771',
              '#3E424B',
              '#30333B',
              '#292B34',
              '#21242A',
              '#1A1D23',
              '#131519'
            ],
          },
          primaryColor: 'grape',
          primaryShade: 5,
          defaultGradient: { from: 'violet', to: 'pink' },

          components: {
            InputWrapper: {
              styles: (theme) => ({
                description: {
                  marginTop: 1,
                  marginBottom: 10,
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
                    background: `linear-gradient(to right, ${theme.colors.blue[4]} 4px, ${theme.colors.dark[4]} 0)`,
                  },
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
          }
        }}
      >
        <Notifications position='top-right' />
        <ModalsProvider modals={modals}>
          <Component {...pageProps} />
        </ModalsProvider>
      </MantineProvider >
    </SessionProvider>
  );
}