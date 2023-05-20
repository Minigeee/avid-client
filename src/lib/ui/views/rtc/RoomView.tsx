import { useEffect, useRef, useState } from 'react';

import {
  ActionIcon,
  AspectRatio,
  Avatar,
  Box,
  Center,
  Group,
  Popover,
  ScrollArea,
  Slider,
  Stack,
  Text,
} from '@mantine/core';
import { useElementSize } from '@mantine/hooks';

import { IconDotsVertical, IconVolume, IconVolume2, IconVolume3 } from '@tabler/icons-react';

import SidePanelView from './SidePanelView';
import MemberAvatar from '@/lib/ui/components/MemberAvatar';

import { AppState } from '@/lib/contexts';
import { getMembers } from '@/lib/db';
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
            <Text size={Math.max(props.textSize * 0.8, 15)} sx={(theme) => ({
              position: 'absolute',
              left: 2,
              bottom: 2,
              padding: '1px 6px 1px 6px',
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
export default function RoomView(props: RoomViewProps) {
  const app = useApp();
  const session = useSession();

  const { ref: viewportRef, height: viewportHeight } = useElementSize();

  useEffect(() => {
    // If domain provided, it must be loaded
    if (props.domain && !props.domain._exists) return;

    // Connect to room if not connected
    if (!app.rtc?.joined || app.rtc?.room_id !== props.channel.id) {
      // Connect
      app._mutators.rtc.connect(props.channel.id, props.domain.id);
    }
  }, []);

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

  const gridWidth = Math.min(Math.ceil(Math.sqrt(participants.length - 1)), 5) || 1;
  const cellWidth = (1 / gridWidth) * 100;
  const avatarSize = 36 + 30 * (1 / gridWidth);
  const textSize = 12 + 10 * (1 / gridWidth);

  console.log(participants)


  return (
    <Box sx={{
      display: 'flex',
      height: '100%',
    }}>
      {participants.length === 1 && (
        <Center sx={{
          flexGrow: 1,
          height: '100%',
        }}>
          <Stack align='center' spacing='xl'>
            <Avatar size={avatarSize} radius={100} sx={{ backgroundColor: '#333333' }} />
            <Text size={18}>Waiting for more members to join...</Text>
          </Stack>
        </Center>
      )}
      {participants.length > 1 && (
        <ScrollArea viewportRef={viewportRef} sx={{
          flexGrow: 1,
          height: '100%',
        }}>
          <Box sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignContent: 'center',
            padding: 6,
            minHeight: viewportHeight,
          }}>
            {participants.map((member, i) => member.id === session.profile_id ? undefined : (
              <ParticipantView
                member={member}
                app={app}

                cellWidth={cellWidth}
                avatarSize={avatarSize}
                textSize={textSize}
              />
            ))}
          </Box>
        </ScrollArea>
      )}

      <Box sx={(theme) => ({
        flexBasis: '45ch',
        height: '100%',
        boxShadow: `0px 0px 6px ${theme.colors.dark[9]}`,
      })}>
        <SidePanelView
          channel_id={props.channel.id}
          domain={props.domain}
          participants={participants}
        />
      </Box>
    </Box>
  );
}
