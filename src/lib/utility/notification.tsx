import { Code, Stack, Text } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { IconInfoCircle, IconX } from '@tabler/icons-react';

////////////////////////////////////////////////////////////
const LAST_SHOWN: Record<string, number> = {};

/**
 * Display an error notification
 *
 * @param title The title of the nofication
 * @param message The message of the notification
 * @param cooldown The minimum amount of time required between showing the same notification twice
 * @returns True if the notification was successfully displayed (the cooldown condition was met)
 */
export function error(
  title: string,
  message: string,
  error?: Error,
  cooldown: number = 60,
) {
  // Don't run on server
  if (typeof window === 'undefined') return;

  // Check when noti was last shown
  const key = `${title}.${message}`;
  const last_shown = LAST_SHOWN[key] || 0;
  const now = Date.now();

  if (now - last_shown > cooldown * 1000) {
    showNotification({
      title,
      message: (
        <Stack spacing='xs'>
          <Text>{message}</Text>
          {error && (
            <Code
              sx={(theme) => {
                const panel =
                  theme.other?.colors?.panel ||
                  theme.colors.gray[theme.colorScheme === 'light' ? 1 : 8];
                const panel_text =
                  theme.other?.colors?.panel_text ||
                  theme.colors.gray[theme.colorScheme === 'light' ? 8 : 2];

                return {
                  padding: '0.3rem 0.5rem',
                  background: panel,
                  color: panel_text,
                };
              }}
            >
              {error.name}: {error.message}
            </Code>
          )}
        </Stack>
      ),
      color: 'red',
      icon: <IconX />,
      sx: (theme) => ({
        boxShadow: theme.shadows.md,
      }),
    });

    // Update last shown
    LAST_SHOWN[key] = now;

    return true;
  }

  return false;
}

/**
 * Display an info notification
 *
 * @param title The title of the nofication
 * @param message The message of the notification
 * @param cooldown The minimum amount of time required between showing the same notification twice
 * @returns True if the notification was successfully displayed (the cooldown condition was met)
 */
export function info(title: string, message: string, cooldown: number = 60) {
  // Don't run on server
  if (typeof window === 'undefined') return;

  showNotification({
    title,
    message,
    color: 'blue',
    icon: <IconInfoCircle />,
  });
}

const notification = {
  error,
  info,
};
export default notification;
