import { PropsWithChildren, useMemo, useRef } from 'react';

import {
  ActionIcon,
  Flex,
  Group,
  Menu, Slider, Text
} from '@mantine/core';
import {
  IconArrowBackUp,
  IconCopy,
  IconLink,
  IconMicrophone,
  IconMicrophoneOff,
  IconMoodMinus,
  IconMoodPlus,
  IconMoodX,
  IconPencil,
  IconPhoto,
  IconPin,
  IconPinnedOff,
  IconScreenShare,
  IconScreenShareOff,
  IconTrash,
  IconUserX,
  IconVideo,
  IconVideoOff,
  IconVolume,
  IconVolume2,
  IconVolumeOff
} from '@tabler/icons-react';

import { ContextMenu } from '@/lib/ui/components/ContextMenu';
import { useConfirmModal } from '@/lib/ui/modals/ConfirmModal';

import { DomainWrapper, MessagesWrapper, hasPermission, useRtc } from '@/lib/hooks';
import { ExpandedMember, ExpandedMessage, Member } from '@/lib/types';
import { RtcParticipant } from '@/lib/contexts';


////////////////////////////////////////////////////////////
export type RtcMenuProps = PropsWithChildren & {
  /** The domain the rtc room is in */
  domain: DomainWrapper;
};

////////////////////////////////////////////////////////////
export type RtcMenuContext = {
	/** The member object that is being targeted */
	member: ExpandedMember;
};

////////////////////////////////////////////////////////////
type RtcMenuDropdownProps = Omit<RtcMenuProps, 'children'> & RtcMenuContext;


////////////////////////////////////////////////////////////
export function RtcMenuDropdown({ member, ...props }: RtcMenuDropdownProps) {
	const rtc = useRtc();

  const participant = rtc.participants?.[member.id];

  // Rtc must exist
  if (!participant)
    return null;

  // Permissions
  const canManage = !participant.is_admin && (props.domain._permissions.is_admin || rtc.room_id && hasPermission(props.domain, rtc.room_id, 'can_manage_participants') && !participant.is_manager);

  return (
    <>
      <Menu.Label>{member.alias}</Menu.Label>

      {!rtc.is_deafened && participant.audio && (
        <Flex wrap='nowrap' gap={12} align='center' m='0.1rem 0.6rem' mb='0.4rem'>
          <ActionIcon onClick={() => {
            if (participant.audio?.paused.local)
              rtc._mutators.resume(participant.id, 'audio');
            else
              rtc._mutators.pause(participant.id, 'audio');
          }}>
            {participant.audio.paused.local || participant.volume === 0 ? <IconVolumeOff size={20} /> : participant.volume >= 50 ? <IconVolume size={20} /> : <IconVolume2 size={20} />}
          </ActionIcon>

          <Slider
            label={(value) => `${value}%`}
            value={participant.audio.paused.local ? 0 : participant.volume}
            onChange={(value) => {
              if (rtc.joined)
                rtc._mutators.audio.setVolume(member.id, value);
            }}
            sx={{ flexGrow: 1 }}
          />
        </Flex>
      )}

      {canManage && (
        <>
          <Menu.Item
            icon={participant.locked.audio ? <IconMicrophone size={17} /> : <IconMicrophoneOff size={17} />}
            onClick={() => {
              if (participant.locked.audio)
                rtc._mutators.unlock(member.id, 'audio');
              else
                rtc._mutators.lock(member.id, 'audio');
            }}
          >
            {participant.locked.audio ? 'Unlock Microphone' : !participant.audio || participant.audio.paused.remote ? 'Lock Microphone' : 'Disable Microphone'}
          </Menu.Item>

          <Menu.Item
            icon={participant.locked.video ? <IconVideo size={17} /> : <IconVideoOff size={17} />}
            onClick={() => {
              if (participant.locked.video)
                rtc._mutators.unlock(member.id, 'video');
              else
                rtc._mutators.lock(member.id, 'video');
            }}
          >
            {participant.locked.video ? 'Unlock Webcam' : !participant.video || participant.video.paused.remote ? 'Lock Webcam' : 'Disable Webcam'}
          </Menu.Item>

          <Menu.Item
            icon={participant.locked.share ? <IconScreenShare size={17} /> : <IconScreenShareOff size={17} />}
            onClick={() => {
              if (participant.locked.share)
                rtc._mutators.unlock(member.id, 'share');
              else
                rtc._mutators.lock(member.id, 'share');
            }}
          >
            {participant.locked.share ? 'Unlock Screen Share' : !participant.share || participant.share.paused.remote ? 'Lock Screen Share' : 'Disable Screen Share'}
          </Menu.Item>

          <Menu.Divider />

          <Menu.Item
            icon={<IconUserX size={17} />}
            color='red'
          >
            Kick <b>{member.alias}</b>
          </Menu.Item>
        </>
      )}
    </>
  )
}


////////////////////////////////////////////////////////////
export function RtcContextMenu(props: RtcMenuProps) {
  return (
    <ContextMenu
      width='16rem'
    >
      <ContextMenu.Dropdown dependencies={[props.domain._permissions]}>
        {(context: RtcMenuContext) => (
          <RtcMenuDropdown
            domain={props.domain}
            {...context}
          />
        )}
      </ContextMenu.Dropdown>

      {props.children}
    </ContextMenu>
  );
}
