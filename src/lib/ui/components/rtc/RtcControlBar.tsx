import { PropsWithChildren, useCallback, useState } from 'react';
import assert from 'assert';

import {
  ActionIcon,
  ActionIconProps,
  Affix,
  Box,
  Divider,
  Group,
  MantineColor,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';

import {
  IconArrowBackUp,
  IconHeadphones,
  IconHeadphonesOff,
  IconMicrophone,
  IconMicrophoneOff,
  IconPhoneX,
  IconScreenShare,
  IconScreenShareOff,
  IconSettings,
  IconVideo,
  IconVideoOff,
} from '@tabler/icons-react';

import { hasPermission, useApp, useDomain, useRtc } from '@/lib/hooks';

////////////////////////////////////////////////////////////
type ControlButtonProps = PropsWithChildren & {
  active?: boolean;
  disabled?: boolean;
  tooltip?: string;
  color?: [MantineColor, number];
  onClick?: () => unknown;

  buttonProps?: ActionIconProps;
};

////////////////////////////////////////////////////////////
function ControlButton({
  active,
  disabled,
  tooltip,
  color,
  ...props
}: ControlButtonProps) {
  const CustomTooltip = useCallback(
    ({ children }: PropsWithChildren) => (
      <Tooltip
        label={tooltip || ''}
        position="top"
        withArrow
        openDelay={500}
        sx={(theme) => ({ backgroundColor: theme.colors.dark[9] })}
      >
        {children}
      </Tooltip>
    ),
    [tooltip],
  );

  return (
    <CustomTooltip>
      <ActionIcon
        sx={(theme) => ({
          backgroundColor: theme.colors.dark[active ? 4 : 7],
          color: color ? theme.colors[color[0]][color[1]] : undefined,
          '&:hover': {
            backgroundColor: theme.colors.dark[active ? 4 : 6],
          },
          '&[data-disabled]': {
            backgroundColor: theme.colors.dark[7],
            borderColor: theme.colors.dark[7],
          },
        })}
        disabled={disabled}
        onClick={props.onClick}
        {...props.buttonProps}
      >
        {props.children}
      </ActionIcon>
    </CustomTooltip>
  );
}

////////////////////////////////////////////////////////////
export default function RtcControlBar() {
  const app = useApp();
  const rtc = useRtc();

  const [webcamLoading, setWebcamLoading] = useState<boolean>(false);

  // Check if viewing room
  const room_id = rtc.room_id;
  const inRoom =
    app.domain === rtc.domain_id &&
    app.channels?.[app.domain || ''] === room_id;

  // Get domain for permissions
  const domain = useDomain(rtc.domain_id || undefined);

  // Rtc permissions
  const canSpeak =
    domain._exists && room_id
      ? hasPermission(domain, room_id, 'can_broadcast_audio')
      : false;
  const canVideo =
    domain._exists && room_id
      ? hasPermission(domain, room_id, 'can_broadcast_video')
      : false;

  return (
    <Group
      spacing={6}
      sx={(theme) => ({
        padding: 6,
        backgroundColor: theme.colors.dark[7],
        borderRadius: 6,
      })}
    >
      {!inRoom && (
        <>
          <ControlButton
            tooltip={'Return To Room'}
            onClick={() => {
              assert(rtc._exists);

              // Return to room
              app._mutators.setDomain(rtc.domain_id);
              app._mutators.setChannel(rtc.room_id, rtc.domain_id);
            }}
          >
            <IconArrowBackUp size={20} />
          </ControlButton>

          <Divider orientation="vertical" mt={3} mb={3} />
        </>
      )}

      <ControlButton
        tooltip={rtc.is_screen_shared ? 'Stop Sharing' : 'Share Screen'}
        active={rtc.is_screen_shared}
        disabled={!canVideo || rtc.is_share_locked}
        onClick={() => {
          if (rtc.is_screen_shared) rtc._mutators.screenshare.disable();
          else rtc._mutators.screenshare.enable();
        }}
      >
        {!rtc.is_screen_shared && <IconScreenShare size={19} />}
        {rtc.is_screen_shared && <IconScreenShareOff size={19} />}
      </ControlButton>

      <ControlButton
        tooltip={rtc.is_webcam_on ? 'Disable Webcam' : 'Enable Webcam'}
        buttonProps={{ loading: webcamLoading }}
        disabled={!canVideo || rtc.is_webcam_locked}
        onClick={async () => {
          if (rtc.is_webcam_on) rtc._mutators.webcam.disable();
          else {
            setWebcamLoading(true);
            await rtc._mutators.webcam.enable();
            setWebcamLoading(false);
          }
        }}
      >
        {rtc.is_webcam_on && <IconVideo size={20} />}
        {!rtc.is_webcam_on && <IconVideoOff size={20} />}
      </ControlButton>

      <ControlButton
        tooltip={rtc.is_mic_muted ? 'Unmute' : 'Mute'}
        disabled={!canSpeak || rtc.is_mic_locked}
        onClick={() => {
          // Enable if not enabled first
          if (!rtc.is_mic_enabled) rtc._mutators.microphone.enable();
          else if (rtc.is_mic_muted) rtc._mutators.microphone.unmute();
          else rtc._mutators.microphone.mute();
        }}
      >
        {!rtc.is_mic_muted && <IconMicrophone size={20} />}
        {rtc.is_mic_muted && <IconMicrophoneOff size={20} />}
      </ControlButton>

      <ControlButton
        tooltip={rtc.is_deafened ? 'Undeafen' : 'Deafen'}
        onClick={() => {
          if (rtc.is_deafened) rtc._mutators.audio.undeafen();
          else rtc._mutators.audio.deafen();
        }}
      >
        {!rtc.is_deafened && <IconHeadphones size={20} />}
        {rtc.is_deafened && <IconHeadphonesOff size={20} />}
      </ControlButton>

      <ControlButton tooltip="Settings" disabled>
        <IconSettings size={20} />
      </ControlButton>

      <Divider orientation="vertical" mt={3} mb={3} />

      <ControlButton
        tooltip="Leave"
        color={['red', 5]}
        onClick={() => rtc._mutators.disconnect()}
      >
        <IconPhoneX size={20} />
      </ControlButton>
    </Group>
  );
}
