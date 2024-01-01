import { useMemo } from 'react';

import {
  ActionIcon,
  ActionIconProps,
  Box,
  Center,
  Tooltip,
} from '@mantine/core';
import {
  IconMicrophone,
  IconMicrophoneOff,
  IconScreenShare,
  IconScreenShareOff,
  IconVideo,
  IconVideoOff,
} from '@tabler/icons-react';

import {
  MediaType,
  RtcConsumer,
  RtcContextState,
  RtcParticipant,
} from '@/lib/contexts';

////////////////////////////////////////////////////////////
export type ProducerIconProps = {
  /** Rtc state (used for mutations) */
  rtc: RtcContextState;
  /** The participant to create icons for */
  participant: RtcParticipant | undefined;
  /** The type of the producer */
  type: MediaType;
  /** Indicates if the user can manage the participant */
  canManage: boolean;
  /** Action icon props */
  iconProps?: ActionIconProps;
};

////////////////////////////////////////////////////////////
export default function ProducerIcon(props: ProducerIconProps) {
  const locked = props.participant?.locked[props.type];
  const producer = props.participant?.[props.type] as RtcConsumer;

  // Icon
  const icon = useMemo(() => {
    if (locked) {
      if (props.type === 'audio') return <IconMicrophoneOff size={18} />;
      else if (props.type === 'video') return <IconVideoOff size={18} />;
      else return <IconScreenShareOff size={18} />;
    } else if (!producer?.paused.remote) {
      if (props.type === 'audio') return <IconMicrophone size={18} />;
      else if (props.type === 'video') return <IconVideo size={18} />;
      else return <IconScreenShare size={18} />;
    } else return null;
  }, [producer, locked]);

  // Tooltip label
  const tooltip = useMemo<string>(() => {
    if (locked) {
      if (props.type === 'audio') return 'Unlock Microphone';
      else if (props.type === 'video') return 'Unlock Webcam';
      else return 'Unlock Screen Share';
    } else if (!producer?.paused.remote) {
      if (props.type === 'audio') return 'Disable Microphone';
      else if (props.type === 'video') return 'Disable Webcam';
      else return 'Disable Screen Share';
    } else return '';
  }, [producer, locked]);

  if (!producer?.paused.remote || locked) {
    if (props.canManage) {
      return (
        <Tooltip label={tooltip}>
          <ActionIcon
            {...props.iconProps}
            onClick={() => {
              if (!props.participant) return;
              if (locked)
                props.rtc._mutators.unlock(props.participant.id, props.type);
              else props.rtc._mutators.lock(props.participant.id, props.type);
            }}
          >
            {icon}
          </ActionIcon>
        </Tooltip>
      );
    } else {
      return (
        <Center w={28} h={28}>
          {icon}
        </Center>
      );
    }
  } else return null;
}
