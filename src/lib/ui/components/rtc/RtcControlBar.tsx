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
  IconVideoOff
} from '@tabler/icons-react';

import { hasPermission, useApp, useDomain } from '@/lib/hooks';


////////////////////////////////////////////////////////////
type ControlButtonProps = PropsWithChildren & {
  active?: boolean;
  disabled?: boolean;
  tooltip?: string;
  color?: [MantineColor, number];
  onClick?: () => unknown,

  buttonProps?: ActionIconProps;
}

////////////////////////////////////////////////////////////
function ControlButton({ active, disabled, tooltip, color, ...props }: ControlButtonProps) {
  const CustomTooltip = useCallback(({ children }: PropsWithChildren) => (
    <Tooltip
      label={tooltip || ''}
      position='top'
      withArrow
      openDelay={500}
      sx={(theme) => ({ backgroundColor: theme.colors.dark[9] })}
    >
      {children}
    </Tooltip>
  ), [tooltip]);

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
  
  const [webcamLoading, setWebcamLoading] = useState<boolean>(false);

  // Check if viewing room
  const domain_id = app.navigation.domain;
  const room_id = app.rtc?.room_id;
  const inRoom = domain_id === app.rtc?.domain_id && app.navigation.channels?.[domain_id || ''] === room_id;

  // Get domain for permissions
  const domain = useDomain(domain_id);
  
  // Rtc permissions
  const canSpeak = domain._exists && room_id ? hasPermission(domain, room_id, 'can_speak') : false;
  const canVideo =  domain._exists && room_id ? hasPermission(domain, room_id, 'can_share_video') : false;


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
              assert(app.rtc);

              // Return to room
              app._mutators.navigation.setDomain(app.rtc.domain_id);
              app._mutators.navigation.setChannel(app.rtc.room_id, app.rtc.domain_id);
            }}
          >
            <IconArrowBackUp size={20} />
          </ControlButton>

          <Divider orientation='vertical' mt={3} mb={3} />
        </>
      )}
      
      <ControlButton
        tooltip={app.rtc?.is_screen_shared ? 'Stop Sharing' : 'Share Screen'}
        active={app.rtc?.is_screen_shared}
        disabled={!canVideo}
        onClick={() => {
          if (app.rtc?.is_screen_shared)
            app._mutators.rtc.screenshare.disable();
          else
            app._mutators.rtc.screenshare.enable();
        }}
      >
        {!app.rtc?.is_screen_shared && <IconScreenShare size={19} />}
        {app.rtc?.is_screen_shared && <IconScreenShareOff size={19} />}
      </ControlButton>

      <ControlButton
        tooltip={app.rtc?.is_webcam_on ? 'Disable Webcam' : 'Enable Webcam'}
        buttonProps={{ loading: webcamLoading }}
        disabled={!canVideo}
        onClick={async () => {
          if (app.rtc?.is_webcam_on)
            app._mutators.rtc.webcam.disable();
          else {
            setWebcamLoading(true);
            await app._mutators.rtc.webcam.enable();
            setWebcamLoading(false);
          }
        }}
      >
        {app.rtc?.is_webcam_on && <IconVideo size={20} />}
        {!app.rtc?.is_webcam_on && <IconVideoOff size={20} />}
      </ControlButton>

      <ControlButton
        tooltip={app.rtc?.is_mic_muted ? 'Unmute' : 'Mute'}
        disabled={!canSpeak}
        onClick={() => {
          // Enable if not enabled first
          if (!app.rtc?.is_mic_enabled)
            app._mutators.rtc.microphone.enable();
            
          else if (app.rtc?.is_mic_muted)
            app._mutators.rtc.microphone.unmute();
          else
            app._mutators.rtc.microphone.mute();
        }}
      >
        {!app.rtc?.is_mic_muted && <IconMicrophone size={20} />}
        {app.rtc?.is_mic_muted && <IconMicrophoneOff size={20} />}
      </ControlButton>

      <ControlButton
        tooltip={app.rtc?.is_deafened ? 'Undeafen' : 'Deafen'}
        onClick={() => {
          if (app.rtc?.is_deafened)
            app._mutators.rtc.audio.undeafen();
          else
            app._mutators.rtc.audio.deafen();
        }}
      >
        {!app.rtc?.is_deafened && <IconHeadphones size={20} />}
        {app.rtc?.is_deafened && <IconHeadphonesOff size={20} />}
      </ControlButton>

      <ControlButton
        tooltip='Settings'
        disabled
      >
        <IconSettings size={20} />
      </ControlButton>
      
      <Divider orientation='vertical' mt={3} mb={3} />

      <ControlButton
        tooltip='Leave'
        color={['red', 5]}
        onClick={() => app._mutators.rtc.disconnect()}
      >
        <IconPhoneX size={20} />
      </ControlButton>
    </Group>
  );
}
