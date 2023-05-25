import { PropsWithChildren } from 'react';
import { ErrorBoundary as BaseErrorBoundary, ErrorBoundaryProps as BaseErrorBoundaryProps } from 'react-error-boundary';

import { Box, Button, Center, Code, Stack, Text } from '@mantine/core';

import config from '@/config';
import { notifyError } from '@/lib/utility/error-handler';
import { IconAlertHexagon, IconMoodCry, IconReload } from '@tabler/icons-react';


////////////////////////////////////////////////////////////
type ErrorBoundaryProps = PropsWithChildren<{
  title?: string;
  message?: string;
  height?: string;
}>;

////////////////////////////////////////////////////////////
export default function ErrorBoundary({ title, message, ...props }: ErrorBoundaryProps) {


  return (
    <BaseErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <Center w='100%' h={props.height || '100%'}>
          <Stack spacing='xl' align='center'>
            <Box sx={(theme) => ({ color: theme.colors.dark[3] })}>
              <IconAlertHexagon size={64} strokeWidth={1.5} />
            </Box>
  
            <Text align='center' maw='50ch'>
              An error occurred, please try reloading again. If this issues keeps happening,{' '}
              <Text inline color='blue' component='a' href={`mailto:${config.app.contact.email}`}>contact us</Text> or submit a{' '}
              <Text inline color='blue' component='a' href={config.app.contact.feedback_form}>bug report</Text>.
            </Text>
            
            {error && <Code w='90%' sx={(theme) => ({
              padding: '0.3rem 0.5rem',
              backgroundColor: theme.colors.dark[6],
              color: theme.colors.dark[1]
            })}>{error.name}: {error.message}</Code>}
  
            <Button
              variant='gradient'
              leftIcon={<IconReload size={18} />}
              w='20ch'
              onClick={resetErrorBoundary}
            >
              Reload
            </Button>
          </Stack>
        </Center>
      )}
      onError={(error, info) => {
        notifyError(error, { title, message });
      }}
    >
      {props.children}
    </BaseErrorBoundary>
  );
}
