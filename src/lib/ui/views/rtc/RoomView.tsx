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
} from '@tabler/icons-react';

import { openUserSettings } from '@/lib/ui/modals';
import SidePanelView from './SidePanelView';
import MemberAvatar from '@/lib/ui/components/MemberAvatar';
import ChannelIcon from '@/lib/ui/components/ChannelIcon';

import { AppState } from '@/lib/contexts';
import {
  DomainWrapper,
  getMembers,
  hasPermission,
  rtcIo,
  useApp,
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
  member: Participant;
  app: AppState;

  cellWidth: number;
  avatarSize: number;
  textSize: number;
}

////////////////////////////////////////////////////////////
function ParticipantView({ member, app, ...props }: ParticipantViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [showMenu, setShowMenu] = useState<boolean>(false);

  // Get rtc info
  const rtcInfo = app.rtc?.participants[member.id];
  const display = rtcInfo?.share || rtcInfo?.video;
  const volume = rtcInfo?.volume || 0;

  useEffect(() => {
    if (!display || !videoRef.current) return;

    // TEMP : Pause webcam while screen sharing
    if (rtcInfo.share && rtcInfo.video && !rtcInfo.video.paused.local)
      app._mutators.rtc.pause(rtcInfo.id, 'video');
    else if (!rtcInfo.share && rtcInfo.video && rtcInfo.video.paused.local)
      app._mutators.rtc.resume(rtcInfo.id, 'video');

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
        border: member.is_talking ? `solid 3px ${theme.colors.grape[6]}` : 'none',
        backgroundColor: theme.colors.dark[8],
        borderRadius: 6,
        boxShadow: 'rgba(0, 0, 0, 0.1) 0px 4px 12px',
        overflow: 'hidden',
      })}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
        {!display && (
          <Stack align='center' spacing={8}>
            <MemberAvatar size={props.avatarSize} member={member} />
            <Text size={props.textSize} weight={600}>{member.alias}</Text>
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
            <Text size={Math.max(props.textSize * 0.6, 15)} weight={600} sx={(theme) => ({
              position: 'absolute',
              left: 2,
              bottom: 2,
              padding: '0.1rem 0.5rem 0.1rem 0.5rem',
              borderRadius: 3,
              backgroundColor: theme.colors.dark[9] + '80',
            })}>
              {member.alias}
            </Text>
          </>
        )}

        <Popover width='30ch' position='bottom-end' withArrow withinPortal>
          <Popover.Target>
            <ActionIcon
              sx={(theme) => ({
                visibility: showMenu ? 'visible' : 'hidden',
                position: 'absolute',
                right: 10,
                top: 10,
              })}
              onClick={(e) => { e.stopPropagation(); }}
            >
              <IconDotsVertical size={20} />
            </ActionIcon>
          </Popover.Target>

          <Popover.Dropdown onClick={(e) => { e.stopPropagation(); }}>
            <Group noWrap>
              {volume >= 50 && <IconVolume size={24} />}
              {volume > 0 && volume < 50 && <IconVolume2 size={24} />}
              {volume === 0 && <IconVolume3 size={24} />}
              <Slider
                label={(value) => `${value}%`}
                value={volume}
                onChange={(value) => {
                  if (app.rtc?.joined)
                    app._mutators.rtc.audio.setVolume(member.id, value);
                }}
                sx={{ flexGrow: 1 }}
              />
            </Group>
          </Popover.Dropdown>
        </Popover>
      </Box>
    </AspectRatio>
  );
}


////////////////////////////////////////////////////////////
type RoomViewProps = {
  channel: Channel;
  domain: DomainWrapper;
}

////////////////////////////////////////////////////////////
type SubviewProps = RoomViewProps & {
  app: AppState;
};


////////////////////////////////////////////////////////////
function JoinScreen({ app, ...props }: SubviewProps) {
  const session = useSession();

  const [loading, setLoading] = useState<boolean>(false);

  // Load channel data directly (need latest data always)
  const [participants, setParticipants] = useState<Member[] | null>(null);
  useEffect(() => {
    // TODO : Use websockets to sync room participants
    api('GET /channels/:channel_id', {
      params: { channel_id: props.channel.id },
    }, { session })
      .then((results) => {
        const channel = results as Channel<'rtc'>;
        const filtered = channel.data?.participants.filter(x => x !== session.profile_id);
        return filtered ? getMembers(props.domain.id, filtered, session) : [];
      })
      .then(setParticipants);
  }, []);

  // Rtc permissions
  const canSpeak = hasPermission(props.domain, props.channel.id, 'can_broadcast_audio');
  const canVideo = hasPermission(props.domain, props.channel.id, 'can_broadcast_video');
  
  const webcamOn = canVideo && app.rtc?.is_webcam_on;
  const micOn = canSpeak && !app.rtc?.is_mic_muted;

  // Turn off mic if no permission
  useEffect(() => {
    if (!app.rtc?.is_mic_muted && !canSpeak)
      app._mutators.rtc.microphone.mute();
  }, [app.rtc?.is_mic_muted, canSpeak]);

  // Turn off webcam if no permission
  useEffect(() => {
    if (app.rtc?.is_webcam_on && !canVideo)
      app._mutators.rtc.webcam.disable();
  }, [app.rtc?.is_webcam_on, canVideo]);


  return (
    <Center w='100%' h='100%'>
      <Stack spacing='lg' align='center' sx={(theme) => ({
        padding: '2rem',
        width: '30rem',
        maxWidth: '100%',
        backgroundColor: theme.colors.dark[8],
        borderRadius: theme.radius.md,
        boxShadow: '0px 6px 20px #00000030',
      })}>
        <Stack spacing={0} align='center'>
          <Text size='sm' color='dimmed'>You are about to join</Text>
          <Group align='center' spacing='sm'>
            <ChannelIcon type='rtc' size={24} />
            <Title order={3} mb={6}>{props.channel.name}</Title>
          </Group>
        </Stack>

        <Stack spacing={6} align='center'>
          {!participants?.length && (
            <>
              <Avatar size={48} radius={100} sx={{ backgroundColor: '#333333' }} />
              <Text size='xs' color='dimmed'>
                There are no participants in this room
              </Text>
            </>
          )}
          {participants && participants.length > 0 && (
            <>
              <Avatar.Group spacing='md'>
                {participants.slice(0, 3).map((member, i) => (
                  <MemberAvatar
                    key={member.id}
                    size={48}
                    member={member}
                    sx={(theme) => ({ borderWidth: 3, borderColor: theme.colors.dark[8] })}
                  />
                ))}
                {participants.length > 3 && (
                  <Avatar
                    size={48}
                    radius={48}
                    sx={(theme) => ({ borderWidth: 3, borderColor: theme.colors.dark[8] })}
                  >
                    +{participants.length - 3}
                  </Avatar>
                )}
              </Avatar.Group>
              <Text size='xs' color='dimmed'>
                {participants.length} Participant{participants.length > 1 ? 's' : ''}
              </Text>
            </>
          )}
        </Stack>

        <Group spacing='sm' mt={8}>
          <Group spacing={6} mr={4}>
            {webcamOn && <IconVideo size={20} />}
            {!webcamOn && <IconVideoOff size={20} />}
            <Switch
              checked={webcamOn}
              disabled={!canVideo}
              onChange={() => {
                if (!webcamOn)
                  app._mutators.rtc.webcam.enable();
                else
                  app._mutators.rtc.webcam.disable();
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
                if (app.rtc?.is_mic_muted)
                  app._mutators.rtc.microphone.unmute();
                else
                  app._mutators.rtc.microphone.mute();
              }}
            />
          </Group>
          <Group spacing={6} mr={4}>
            {!app.rtc?.is_deafened && <IconHeadphones size={20} />}
            {app.rtc?.is_deafened && <IconHeadphonesOff size={20} />}
            <Switch
              checked={!app.rtc?.is_deafened}
              onChange={() => {
                if (app.rtc?.is_deafened)
                  app._mutators.rtc.audio.undeafen();
                else
                  app._mutators.rtc.audio.deafen();
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
            setLoading(true)
            app._mutators.rtc.connect(props.channel.id, props.domain.id).finally(() => setLoading(false));
          }}
        >
          Join
        </Button>
      </Stack>
    </Center>
  );
}

////////////////////////////////////////////////////////////
function RoomScreen({ app, ...props }: SubviewProps) {
  const session = useSession();

  // Get list of participants
  const [participants, setParticipants] = useState<Participant[]>([]);
  useEffect(() => {
    if (!props.domain._exists || !app.rtc) return;

    // Get members
    const ids = Object.keys(app.rtc.participants);
    if (ids.length > 0)
      getMembers(props.domain.id, ids, session).then((members) => setParticipants(members.map(m => ({ ...m, is_talking: false }))));
    else
      setParticipants([]);
  }, [app.rtc?.participants]);

  // Handle talking indicators
  useEffect(() => {
    function onTalk(participant_id: string, status: 'start' | 'stop') {

      const idx = participants.findIndex(p => p.id === participant_id);
      if (idx < 0) return;

      // Update particpant talking status if different
      const p = participants[idx];
      if ((p.is_talking && status === 'stop') || (!p.is_talking && status === 'start')) {
        const copy = participants.slice();
        copy[idx] = { ...p, is_talking: status === 'start' };
        setParticipants(copy);
      }
    }

    rtcIo()?.on('participant-talk', onTalk);

    return () => {
      rtcIo()?.off('participant-talk', onTalk);
    };
  }, [participants]);

  // Calculate sizes based on number of participants
  const {
    cellWidth,
    avatarSize,
    textSize,
  } = useMemo(() => {
    let gridWidth = 1;
    if (participants.length > 6)
      gridWidth = 3
    else if (participants.length > 1)
      gridWidth = 2;
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
      {!participants.length && (
        <Center sx={{ flexGrow: 1 }}>
          <Stack align='center' spacing='xl'>
            <Avatar size={avatarSize} radius={100} sx={{ backgroundColor: '#333333' }} />
            <Text size={18}>Waiting for more members to join...</Text>
          </Stack>
        </Center>
      )}
      {participants.length > 0 && (
        <ScrollArea
          h='100%'
          sx={{ flexGrow: 1 }}
        >
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
                member={member}
                app={app}

                cellWidth={cellWidth}
                avatarSize={avatarSize}
                textSize={textSize}
              />
            ))}
          </Flex>
        </ScrollArea>
      )}

      <Box sx={(theme) => ({
        flexBasis: '45ch',
        boxShadow: `0px 0px 6px ${theme.colors.dark[9]}`,
      })}>
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

  if (!app.rtc?.joined || app.rtc?.room_id !== props.channel.id) {
    return (
      <JoinScreen
        {...props}
        app={app}
      />
    );
  }
  else {
    return (
      <RoomScreen
        {...props}
        app={app}
      />
    );
  }
}
