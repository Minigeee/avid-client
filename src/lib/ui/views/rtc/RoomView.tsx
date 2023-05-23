import { useEffect, useMemo, useRef, useState } from 'react';

import {
  ActionIcon,
  AspectRatio,
  Avatar,
  Box,
  Button,
  Center,
  Flex,
  Group,
  Popover,
  ScrollArea,
  Slider,
  Stack,
  Switch,
  Text,
  Title,
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
} from '@tabler/icons-react';

import SidePanelView from './SidePanelView';
import MemberAvatar from '@/lib/ui/components/MemberAvatar';
import ChannelIcon from '@/lib/ui/components/ChannelIcon';

import { AppState } from '@/lib/contexts';
import { getChannel, getMembers } from '@/lib/db';
import {
  DomainWrapper,
  useApp,
  useSession,
} from '@/lib/hooks';
import { Channel, Member } from '@/lib/types';


////////////////////////////////////////////////////////////
type ParticipantViewProps = {
  member: Member;
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
    getChannel<'rtc'>(props.channel.id, session)
      .then((channel) => {
        const filtered = channel.data?.participants.filter(x => x !== session.profile_id);
        return filtered ? getMembers(props.domain.id, filtered, session) : [];
      })
      .then(setParticipants);
  }, []);

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

        <Group mt={8}>
          <Group spacing={6}>
            {!app.rtc?.is_mic_muted && <IconMicrophone size={20} />}
            {app.rtc?.is_mic_muted && <IconMicrophoneOff size={20} />}
            <Switch
              checked={!app.rtc?.is_mic_muted}
              onChange={() => {
                if (app.rtc?.is_mic_muted)
                  app._mutators.rtc.microphone.unmute();
                else
                  app._mutators.rtc.microphone.mute();
              }}
            />
          </Group>
          <Group spacing={6}>
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
        </Group>

        <Button
          variant='gradient'
          loading={loading}
          w='8rem'
          onClick={() => {
            setLoading(true)
            app._mutators.rtc.connect(props.channel.id, props.domain.id);
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
  const [participants, setParticipants] = useState<Member[]>([]);
  useEffect(() => {
    if (!props.domain._exists || !app.rtc) return;

    // Get members
    const ids = Object.keys(app.rtc.participants);
    if (ids.length > 0)
      getMembers(props.domain.id, ids, session).then(setParticipants);
    else
      setParticipants([]);
  }, [app.rtc?.participants]);

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
