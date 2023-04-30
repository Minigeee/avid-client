import { PropsWithChildren, useState } from 'react';
import assert from 'assert';

import {
  ActionIcon,
  Affix,
  Box,
  Divider,
  Group,
  MantineColor,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';

import { ArrowBackUp, Headphones, HeadphonesOff, Microphone, MicrophoneOff, PhoneX, ScreenShare, ScreenShareOff, Settings, Video } from 'tabler-icons-react';

import { useApp } from '@/lib/hooks';


////////////////////////////////////////////////////////////
type ControlButtonProps = PropsWithChildren & {
  active?: boolean;
  disabled?: boolean;
  tooltip?: string;
  color?: [MantineColor, number];
  onClick?: () => unknown,
}

////////////////////////////////////////////////////////////
function ControlButton({ active, disabled, tooltip, color, ...props }: ControlButtonProps) {
  return (
    <Tooltip
      label={tooltip || ''}
      position='top'
      withArrow
      openDelay={500}
      sx={(theme) => ({ backgroundColor: theme.colors.dark[9] })}
    >
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
      >
        {props.children}
      </ActionIcon>
    </Tooltip>
  );
}


////////////////////////////////////////////////////////////
export default function RtcControlBar() {
  const app = useApp();

  // Check if viewing room
  const domain_id = app.navigation.domain;
  const inRoom = domain_id === app.rtc?.domain_id && app.navigation.channels?.[domain_id || ''] === app.rtc?.room_id;

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
            <ArrowBackUp size={20} />
          </ControlButton>

          <Divider orientation='vertical' mt={3} mb={3} />
        </>
      )}

      <ControlButton
        tooltip={'Enable Camera'}
        onClick={() => {
        }}
      >
        <Video size={20} />
      </ControlButton>
      
      <ControlButton
        tooltip={app.rtc?.is_screen_shared ? 'Stop Sharing' : 'Share Screen'}
        active={app.rtc?.is_screen_shared}
        onClick={() => {
          if (app.rtc?.is_screen_shared)
            app._mutators.rtc.screenshare.disable();
          else
            app._mutators.rtc.screenshare.enable();
        }}
      >
        {!app.rtc?.is_screen_shared && <ScreenShare size={19} />}
        {app.rtc?.is_screen_shared && <ScreenShareOff size={19} />}
      </ControlButton>

      <ControlButton
        tooltip={app.rtc?.is_mic_muted ? 'Unmute' : 'Mute'}
        disabled={!app.rtc?.is_mic_enabled}
        onClick={() => {
          if (app.rtc?.is_mic_muted)
            app._mutators.rtc.microphone.unmute();
          else
            app._mutators.rtc.microphone.mute();
        }}
      >
        {!app.rtc?.is_mic_muted && <Microphone size={20} />}
        {app.rtc?.is_mic_muted && <MicrophoneOff size={20} />}
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
        {!app.rtc?.is_deafened && <Headphones size={20} />}
        {app.rtc?.is_deafened && <HeadphonesOff size={20} />}
      </ControlButton>

      <ControlButton
        tooltip='Settings'
      >
        <Settings size={20} />
      </ControlButton>
      
      <Divider orientation='vertical' mt={3} mb={3} />

      <ControlButton
        tooltip='Leave'
        color={['red', 5]}
        onClick={() => app._mutators.rtc.disconnect()}
      >
        <PhoneX size={20} />
      </ControlButton>
    </Group>
  );
}
