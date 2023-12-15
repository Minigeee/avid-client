import { useEffect, useMemo, useRef, useState } from 'react';

import {
  ActionIcon,
  AspectRatio,
  Avatar,
  Box,
  Button,
  Center,
  Divider,
  Flex,
  Group,
  Menu,
  Popover,
  ScrollArea,
  Slider,
  Stack,
  Switch,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';

import {
  IconHeadphones,
  IconHeadphonesOff,
  IconDotsVertical,
  IconMicrophone,
  IconMicrophoneOff,
  IconPhoneX,
  IconScreenShare,
  IconScreenShareOff,
  IconSettings,
  IconVideo,
  IconVolume,
  IconVolume2,
  IconVolume3,
  IconVideoOff,
  IconRepeat,
  IconVolumeOff,
} from '@tabler/icons-react';

import { openUserSettings } from '@/lib/ui/modals';
import SidePanelView from './SidePanelView';
import MemberAvatar from '@/lib/ui/components/MemberAvatar';
import ChannelIcon from '@/lib/ui/components/ChannelIcon';
import { ContextMenu } from '@/lib/ui/components/ContextMenu';
import ProducerIcon from './components/ProducerIcon';
import {
  RtcContextMenu,
  RtcMenuContext,
  RtcMenuDropdown,
} from './components/RtcMenu';

import { AppState, RtcContextState, rtcIo } from '@/lib/contexts';
import {
  DomainWrapper,
  hasPermission,
  useApp,
  useMembers,
  useRtc,
  useSession,
} from '@/lib/hooks';
import { Channel, Member } from '@/lib/types';
import { api } from '@/lib/api';

////////////////////////////////////////////////////////////
type Participant = Member & {
  is_talking: boolean;
};

////////////////////////////////////////////////////////////
type ParticipantViewProps = {
  domain: DomainWrapper;
  rtc: RtcContextState;
  member: Participant;

  cellWidth: number;
  avatarSize: number;
  textSize: number;
};

////////////////////////////////////////////////////////////
function ParticipantView({ member, rtc, ...props }: ParticipantViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Determines if webcam or screen share should be shown
  const [webcamPriority, setWebcamPriority] = useState<boolean>(false);

  // Get rtc info
  const rtcInfo = rtc.participants[member.id];
  const display = webcamPriority
    ? rtcInfo?.video || rtcInfo?.share
    : rtcInfo?.share || rtcInfo?.video;
  const volume = rtcInfo?.volume || 0;

  // Permissions
  const canManage =
    !rtcInfo.is_admin &&
    (props.domain._permissions.is_admin ||
      (hasPermission(props.domain, rtc.room_id, 'can_manage_participants') &&
        !rtcInfo.is_manager));

  // Handle playing video
  useEffect(() => {
    if (!display || !videoRef.current) return;

    // TEMP : Pause webcam while screen sharing
    if (rtcInfo.share && rtcInfo.video && !rtcInfo.video.paused.local)
      rtc._mutators.pause(rtcInfo.id, 'video');
    else if (!rtcInfo.share && rtcInfo.video && rtcInfo.video.paused.local)
      rtc._mutators.resume(rtcInfo.id, 'video');

    // Set video element source
    const mstream = new MediaStream([display.track]);
    videoRef.current.srcObject = mstream;
    videoRef.current.play().catch(console.warn);
  }, [display, videoRef.current]);

  return (
    <AspectRatio
      ratio={16 / 9}
      sx={(theme) => ({
        flex: `0 0 calc(${props.cellWidth}% - 10px)`,
        margin: 5,
        border: member.is_talking
          ? `solid 3px ${theme.colors.grape[6]}`
          : 'none',
        backgroundColor: theme.colors.dark[8],
        borderRadius: 6,
        boxShadow: 'rgba(0, 0, 0, 0.1) 0px 4px 12px',
        overflow: 'hidden',
      })}
    >
      <ContextMenu.Trigger
        context={
          {
            member: member,
          } as RtcMenuContext
        }
        sx={{ position: 'relative', width: '100%', height: '100%' }}
      >
        {!display && (
          <Stack align='center' spacing={8}>
            <MemberAvatar size={props.avatarSize} member={member} />
            <Text size={props.textSize} weight={600}>
              {member.alias}
            </Text>
          </Stack>
        )}
        {display && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              controls={false}
              style={{
                width: '100%',
                height: '100%',
              }}
            />
            <Text
              size={Math.max(props.textSize * 0.6, 15)}
              weight={600}
              sx={(theme) => ({
                position: 'absolute',
                left: 2,
                bottom: 2,
                padding: '0.1rem 0.5rem 0.1rem 0.5rem',
                borderRadius: 3,
                backgroundColor: theme.colors.dark[9] + '80',
              })}
            >
              {member.alias}
            </Text>
          </>
        )}

        <Group
          spacing={2}
          sx={(theme) => ({
            position: 'absolute',
            right: '0.5rem',
            top: '0.5rem',
            padding: 2,
            backgroundColor: display ? theme.colors.dark[9] + '80' : undefined,
          })}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {((rtcInfo.share && !rtcInfo.share.paused.remote) ||
            rtcInfo.locked.share) && (
            <ProducerIcon
              participant={rtcInfo}
              type='share'
              rtc={rtc}
              canManage={canManage}
            />
          )}
          {((rtcInfo.video && !rtcInfo.video.paused.remote) ||
            rtcInfo.locked.video) && (
            <ProducerIcon
              participant={rtcInfo}
              type='video'
              rtc={rtc}
              canManage={canManage}
            />
          )}
          {((rtcInfo.audio && !rtcInfo.audio.paused.remote) ||
            rtcInfo.locked.audio) && (
            <ProducerIcon
              participant={rtcInfo}
              type='audio'
              rtc={rtc}
              canManage={canManage}
            />
          )}

          {rtcInfo.is_deafened && (
            <Center w={28} h={28}>
              <IconHeadphonesOff size={19} />
            </Center>
          )}

          {rtcInfo?.share && rtcInfo?.video && (
            <Tooltip
              label={webcamPriority ? 'View Screen Share' : 'View Webcam'}
            >
              <ActionIcon onClick={() => setWebcamPriority(!webcamPriority)}>
                <IconRepeat size={19} />
              </ActionIcon>
            </Tooltip>
          )}

          <Menu width='16rem' position='bottom-end' withArrow>
            <Menu.Target>
              <ActionIcon>
                <IconDotsVertical size={20} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <RtcMenuDropdown domain={props.domain} member={member} />
            </Menu.Dropdown>
          </Menu>
        </Group>
      </ContextMenu.Trigger>
    </AspectRatio>
  );
}

////////////////////////////////////////////////////////////
type RoomViewProps = {
  channel: Channel<'rtc'>;
  domain: DomainWrapper;
};

////////////////////////////////////////////////////////////
type SubviewProps = RoomViewProps & {
  rtc: RtcContextState;
};

////////////////////////////////////////////////////////////
function JoinScreen({
  rtc,
  ...props
}: RoomViewProps & { rtc: RtcContextState<false> }) {
  const session = useSession();

  const [loading, setLoading] = useState<boolean>(false);

  const participants = useMembers(
    props.domain.id,
    props.channel.data?.participants || [],
  );

  // Rtc permissions
  const canSpeak = hasPermission(
    props.domain,
    props.channel.id,
    'can_broadcast_audio',
  );
  const canVideo = hasPermission(
    props.domain,
    props.channel.id,
    'can_broadcast_video',
  );

  const webcamOn = canVideo && rtc.is_webcam_on;
  const micOn = canSpeak && !rtc.is_mic_muted;

  // Turn off mic if no permission
  useEffect(() => {
    if (!rtc.is_mic_muted && !canSpeak) rtc._mutators.microphone.mute();
  }, [rtc.is_mic_muted, canSpeak]);

  // Turn off webcam if no permission
  useEffect(() => {
    if (rtc.is_webcam_on && !canVideo) rtc._mutators.webcam.disable();
  }, [rtc.is_webcam_on, canVideo]);

  // Check if allowed to join
  const canJoin = useMemo(() => {
    // Check if kicked
    const isKicked = rtc.kicked?.has(props.channel.id);

    // If kicked, check if session is over
    if (isKicked) {
      const sessionOver = !props.channel.data?.participants.length;
      if (sessionOver) {
        // If session is over, user is not kicked any more
        rtc._mutators.setState((state) => {
          const newSet = new Set<string>(state.kicked);
          newSet.delete(props.channel.id);
          return { ...state, kicked: newSet };
        });

        // User can join now
        return true;
      }
    }

    return !isKicked;
  }, [rtc.kicked, props.channel.data?.participants.length]);

  return (
    <Center w='100%' h='100%'>
      <Stack
        spacing='lg'
        align='center'
        sx={(theme) => ({
          padding: '2rem',
          width: '30rem',
          maxWidth: '100%',
          backgroundColor: theme.colors.dark[8],
          borderRadius: theme.radius.md,
          boxShadow: '0px 6px 20px #00000030',
        })}
      >
        <Stack spacing={0} align='center'>
          <Text size='sm' color='dimmed'>
            You are about to join
          </Text>
          <Group align='center' spacing='sm'>
            <ChannelIcon type='rtc' size={24} />
            <Title order={3} mb={6}>
              {props.channel.name}
            </Title>
          </Group>
        </Stack>

        <Stack spacing={6} align='center'>
          {!participants.data?.length && (
            <>
              <Avatar
                size={48}
                radius={100}
                sx={{ backgroundColor: '#333333' }}
              />
              <Text size='xs' color='dimmed'>
                There are no participants in this room
              </Text>
            </>
          )}
          {participants._exists && participants.data.length > 0 && (
            <>
              <Avatar.Group spacing='md'>
                {participants.data.slice(0, 3).map((member, i) => (
                  <MemberAvatar
                    key={member.id}
                    size={48}
                    member={member}
                    sx={(theme) => ({
                      borderWidth: 3,
                      borderColor: theme.colors.dark[8],
                    })}
                  />
                ))}
                {participants.data.length > 3 && (
                  <Avatar
                    size={48}
                    radius={48}
                    sx={(theme) => ({
                      borderWidth: 3,
                      borderColor: theme.colors.dark[8],
                    })}
                  >
                    +{participants.data.length - 3}
                  </Avatar>
                )}
              </Avatar.Group>
              <Text size='xs' color='dimmed'>
                {participants.data.length} Participant
                {participants.data.length > 1 ? 's' : ''}
              </Text>
            </>
          )}
        </Stack>

        {canJoin && (
          <>
            <Group spacing='sm' mt={8}>
              <Group spacing={6} mr={4}>
                {webcamOn && <IconVideo size={20} />}
                {!webcamOn && <IconVideoOff size={20} />}
                <Switch
                  checked={webcamOn}
                  disabled={!canVideo}
                  onChange={() => {
                    if (!webcamOn) rtc._mutators.webcam.enable();
                    else rtc._mutators.webcam.disable();
                  }}
                />
              </Group>
              <Group spacing={6} mr={4}>
                {micOn && <IconMicrophone size={20} />}
                {!micOn && <IconMicrophoneOff size={20} />}
                <Switch
                  checked={micOn}
                  disabled={!canSpeak}
                  onChange={() => {
                    if (rtc.is_mic_muted) rtc._mutators.microphone.unmute();
                    else rtc._mutators.microphone.mute();
                  }}
                />
              </Group>
              <Group spacing={6} mr={4}>
                {!rtc.is_deafened && <IconHeadphones size={20} />}
                {rtc.is_deafened && <IconHeadphonesOff size={20} />}
                <Switch
                  checked={!rtc.is_deafened}
                  onChange={() => {
                    if (rtc.is_deafened) rtc._mutators.audio.undeafen();
                    else rtc._mutators.audio.deafen();
                  }}
                />
              </Group>

              <Divider orientation='vertical' />
              <Tooltip label='Settings' position='right' withArrow>
                <ActionIcon onClick={() => openUserSettings({ tab: 'rtc' })}>
                  <IconSettings size={24} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <Button
              variant='gradient'
              loading={loading}
              w='8rem'
              onClick={() => {
                setLoading(true);
                rtc._mutators
                  .connect(props.channel.id, props.domain.id)
                  .finally(() => setLoading(false));
              }}
            >
              Join
            </Button>
          </>
        )}
      </Stack>
    </Center>
  );
}

////////////////////////////////////////////////////////////
function RoomScreen({ rtc, ...props }: SubviewProps) {
  const session = useSession();

  // Get list of participants
  const memberIds = useMemo(
    () => Object.keys(rtc.participants),
    [rtc.participants],
  );
  const members = useMembers(props.domain.id, memberIds);

  // Map of which participants are talking
  const [isTalking, setIsTalking] = useState<Record<string, boolean>>({});

  const participants = useMemo(
    () =>
      members.data?.map((x) => ({
        ...x,
        is_talking: isTalking[x.id] || false,
      })) || [],
    [members, isTalking],
  );

  // Handle talking indicators
  useEffect(() => {
    function onTalk(participant_id: string, status: 'start' | 'stop') {
      const talking = isTalking[participant_id] || false;

      // Update particpant talking status if different
      if ((talking && status === 'stop') || (!talking && status === 'start'))
        setIsTalking({ ...isTalking, [participant_id]: !talking });
    }

    rtcIo()?.on('participant-talk', onTalk);

    return () => {
      rtcIo()?.off('participant-talk', onTalk);
    };
  }, [participants]);

  // Calculate sizes based on number of participants
  const { cellWidth, avatarSize, textSize } = useMemo(() => {
    let gridWidth = 1;
    if (participants.length > 6) gridWidth = 3;
    else if (participants.length > 1) gridWidth = 2;
    const cellWidth = (1 / gridWidth) * 100;
    const avatarSize = 28 + 20 * (1 / gridWidth);
    const textSize = 12 + 6 * (1 / gridWidth);

    return {
      gridWidth,
      cellWidth,
      avatarSize,
      textSize,
    };
  }, [participants.length]);

  return (
    <Flex h='100%' align='stretch'>
      <Box sx={{ flexGrow: 1 }}>
        {!participants.length && (
          <Center w='100%' h='100%'>
            <Stack align='center' spacing='xl'>
              <Avatar
                size={avatarSize}
                radius={100}
                sx={{ backgroundColor: '#333333' }}
              />
              <Text size={18}>Waiting for more members to join...</Text>
            </Stack>
          </Center>
        )}
        {participants.length > 0 && (
          <RtcContextMenu domain={props.domain}>
            <ScrollArea w='100%' h='100%'>
              <Flex
                wrap='wrap'
                justify='center'
                mih='calc(100vh - 2.8rem - 2.8rem)' // This is taken from hardcoded values of header heights
                p={6}
                sx={{ alignContent: 'center' }}
              >
                {participants.map((member, i) => (
                  <ParticipantView
                    key={member.id}
                    domain={props.domain}
                    rtc={rtc}
                    member={member}
                    cellWidth={cellWidth}
                    avatarSize={avatarSize}
                    textSize={textSize}
                  />
                ))}
              </Flex>
            </ScrollArea>
          </RtcContextMenu>
        )}
      </Box>

      <Box
        sx={(theme) => ({
          flexBasis: '25rem',
          height: '100%',
          borderLeft: `1px solid ${theme.colors.dark[6]}`,
        })}
      >
        <SidePanelView
          channel_id={props.channel.id}
          domain={props.domain}
          participants={participants}
        />
      </Box>
    </Flex>
  );
}

////////////////////////////////////////////////////////////
export default function RoomView(props: RoomViewProps) {
  const app = useApp();
  const rtc = useRtc();

  if (!rtc._exists || !rtc.joined || rtc.room_id !== props.channel.id) {
    return <JoinScreen {...props} rtc={rtc} />;
  } else if (rtc._exists) {
    return <RoomScreen {...props} rtc={rtc} />;
  } else {
    return null;
  }
}
