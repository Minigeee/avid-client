import { useEffect, useMemo, useState } from 'react';
import assert from 'assert';

import {
  ActionIcon,
  Box,
  Divider,
  Flex,
  Group,
  Indicator,
  LoadingOverlay,
  ScrollArea,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';

import ErrorBoundary from '@/lib/ui/components/ErrorBoundary';
import ChannelsView from '@/lib/ui/views/main/ChannelsView';
import MessagesView from '@/lib/ui/views/chat/MessagesView';
import RoomView from '@/lib/ui/views/rtc/RoomView';
import CalendarView from '@/lib/ui/views/calendar/CalendarView';
import BoardView from '@/lib/ui/views/projects/BoardView';

import {
  PrivateChannelsWrapper,
  ProfileWrapper,
  getProfileSync,
  useApp,
  useDomain,
  useMessages,
  usePrivateChannels,
  usePrivateMembers,
  useProfileCache,
  useProfiles,
  useRtc,
  useSession,
} from '@/lib/hooks';
import { Channel, ExpandedPrivateChannel, FileAttachment, Profile } from '@/lib/types';
import RightPanelView from './RightPanelView';
import ChannelIcon from '../../components/ChannelIcon';
import RtcControlBar from '../../components/rtc/RtcControlBar';
import ActionButton from '../../components/ActionButton';
import { IconArrowBarLeft, IconPlus } from '@tabler/icons-react';
import ProfileAvatar from '../../components/ProfileAvatar';
import MemberAvatar from '../../components/MemberAvatar';

////////////////////////////////////////////////////////////
type DmChannel = ExpandedPrivateChannel & {
  /** Name of channel */
  alias: string;
  /** Profile picture of panel */
  profile_pictuure?: string;
  /** If partner is online (for non multi member channels) */
  online?: boolean;
};

////////////////////////////////////////////////////////////
type DmViewChannelsProps = {
  /** List of private channels */
  dms: PrivateChannelsWrapper<false>;
  /** Channels to display */
  channels?: DmChannel[];
};

////////////////////////////////////////////////////////////
function DmViewChannels({ dms, channels, ...props }: DmViewChannelsProps) {
  const app = useApp();

  // Currently chosen channel
  const channelId = app.new_private_channel ? null : app.private_channel;

  return (
    <Flex
      direction='column'
      sx={(theme) => ({
        flexShrink: 0,
        width: '20rem',
        height: '100%',
        background: theme.other.elements.channels_panel,
      })}
    >
      <Group
        sx={(theme) => ({
          width: '100%',
          height: '3.0rem',
          paddingLeft: '1.0rem',
          paddingRight: '0.5rem',
          borderBottom: `1px solid ${theme.other.elements.channels_panel_border}`,
        })}
      >
        <Title
          order={4}
          sx={(theme) => ({
            flexGrow: 1,
            color: theme.other.elements.channels_panel_text,
          })}
        >
          Direct Messages
        </Title>
        <div style={{ flexGrow: 1 }} />
        <Tooltip label='New DM' position='left' withArrow>
          <ActionIcon
            sx={(theme) => ({
              '&:hover': {
                background: theme.other.elements.channels_panel_hover,
              },
            })}
            onClick={() => {}}
          >
            <IconPlus size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <ScrollArea sx={{ flexGrow: 1 }}>
        <Stack spacing={0} p='0.5rem 0.25rem'>
          {channels?.map((ch) => {
            const selected = channelId === ch.id;
            const seen = true;

            return (
              <UnstyledButton
                onClick={() => {
                  app._mutators.setPrivateChannel(ch.id);
                }}
              >
                <Flex
                  wrap='nowrap'
                  align='stretch'
                  sx={(theme) => ({
                    width: '100%',
                    minHeight: '2.375rem',
                    borderRadius: theme.radius.sm,
                    overflow: 'hidden',
                    '&:hover': {
                      '.btn-body': {
                        background: theme.other.elements.channels_panel_hover,
                      },
                      '.dropdown': { visibility: 'visible' },
                      '.ping-indicator': { display: 'none' },
                    },
                    '&:focus-within': {
                      '.dropdown': { visibility: 'visible' },
                      '.ping-indicator': { display: 'none' },
                    },
                  })}
                >
                  <Box
                    sx={(theme) => ({
                      flexShrink: 0,
                      flexBasis: '0.25rem',
                      background: selected
                        ? theme.other.elements.channels_panel_highlight
                        : undefined,
                    })}
                  />

                  <Flex
                    className='btn-body'
                    direction='column'
                    justify='center'
                    p='0.25rem 0.25rem 0.25rem 0.75rem'
                    sx={(theme) => ({
                      flexGrow: 1,
                      background: selected
                        ? theme.other.elements.channels_panel_hover
                        : undefined,
                      color:
                        seen && !selected
                          ? theme.other.elements.channels_panel_dimmed
                          : theme.other.elements.channels_panel_text,
                      transition: 'background 0.1s, color 0.1s',
                    })}
                  >
                    <Flex gap={12} align='center'>
                      <Indicator
                        inline
                        position='bottom-end'
                        offset={4}
                        size={12}
                        color='teal'
                        withBorder
                        disabled={!ch.online}
                      >
                        <MemberAvatar member={ch} size={32} />
                      </Indicator>
                      <Stack spacing={0} sx={{ flexGrow: 1 }}>
                        <Text size='sm' weight={600}>
                          {ch.name}
                        </Text>
                        {ch.multi_member && (
                          <Text
                            size='xs'
                            mt={-2}
                            sx={(theme) => ({
                              color: theme.other.elements.channels_panel_dimmed,
                            })}
                          >
                            {ch.members.length} member
                            {ch.members.length === 1 ? '' : 's'}
                          </Text>
                        )}
                      </Stack>

                      {app.private_pings?.[ch.id] !== undefined &&
                        app.private_pings[ch.id] > 0 && (
                          <Text
                            className='ping-indicator'
                            size='xs'
                            weight={600}
                            inline
                            sx={(theme) => ({
                              display: false ? 'none' : undefined,
                              padding: '0.15rem 0.3rem 0.25rem 0.3rem',
                              marginRight: '0.4rem',
                              background: theme.colors.red[5],
                              color: theme.colors.dark[0],
                              borderRadius: '1.0rem',
                            })}
                          >
                            {app.private_pings?.[ch.id]}
                          </Text>
                        )}
                    </Flex>
                  </Flex>
                </Flex>
              </UnstyledButton>
            );
          })}
        </Stack>
      </ScrollArea>
    </Flex>
  );
}

////////////////////////////////////////////////////////////
type DmMessageViewProps = {
  /** List of private channels */
  dms: PrivateChannelsWrapper;
  /** Channel to display message view for */
  channel?: DmChannel;
};

////////////////////////////////////////////////////////////
function DmMessageView({ channel, dms }: DmMessageViewProps) {
  const app = useApp();
  const session = useSession();
  const profileCache = useProfileCache();

  // Members of the channel
  const channelMembersRaw = usePrivateMembers(channel?.id);
  const channelMembers = useMemo(() => {
    if (!channelMembersRaw._exists) return;
    return channelMembersRaw.data.map((m) => ({
      ...m,
      online: getProfileSync(m.id)?.online || m.online,
    }));
  }, [channelMembersRaw, profileCache]);

  // Queued message to send after private channel creation
  const [queuedMsg, setQueuedMsg] = useState<{
    message: string;
    attachments?: FileAttachment[];
  } | null>(null);

  // Id of new private channel, for when user starts a new private channel
  const newChannelId = useMemo(() => {
    if (!app.new_private_channel || !queuedMsg) return;

    // Find new channel
    const newChannel = dms.data.find(
      (ch) =>
        !ch.multi_member &&
        ch.members.findIndex((m) => m === app.new_private_channel?.id) >= 0,
    );
    return newChannel?.id;
  }, [queuedMsg, dms.data, app.new_private_channel]);

  // Messages hook for new channel
  const newChannelMessages = useMessages(newChannelId, undefined);

  // Send message as soon as messages are loaded
  useEffect(() => {
    if (!queuedMsg || !newChannelMessages._exists || !newChannelId) return;

    // Send message
    newChannelMessages._mutators.addMessage(
      queuedMsg.message,
      session.profile_id,
      { attachments: queuedMsg.attachments },
    );

    // Reset queued message
    setQueuedMsg(null);

    // Reset new priv ch, switch to new channel
    app._mutators.setNewPrivateChannel(null);
    app._mutators.setPrivateChannel(newChannelId);
  }, [queuedMsg, newChannelMessages._exists]);

  return (
    <>
      <LoadingOverlay visible={queuedMsg !== null} />
      {app.private_channel && channel && channelMembers && !app.new_private_channel && (
        <MessagesView
          channel_id={app.private_channel}
          domain={undefined}
          members={channelMembers}
        />
      )}
      {app.new_private_channel && (
        <MessagesView
          channel_id={undefined}
          domain={undefined}
          onMessageSend={(message, attachments) => {
            assert(app.new_private_channel);
            if (!dms._exists) return false;

            // Create new private channel
            dms._mutators.createChannel({
              multi_member: false,
              members: [app.new_private_channel.id],
            });

            // Queue message
            setQueuedMsg({ message, attachments });

            return true;
          }}
        />
      )}
    </>
  );
}

////////////////////////////////////////////////////////////
export default function DmView() {
  const app = useApp();
  const rtc = useRtc();
  const session = useSession();

  // List of dms
  const dms = usePrivateChannels();

  // List of profile ids that the user has a one on one dm with
  const partnerIds = useMemo(() => {
    if (!dms._exists) return [];

    const ids: string[] = [];
    for (const dm of dms.data) {
      if (!dm.multi_member)
        ids.push(dm.members.find(m => m !== session.profile_id) || '');
    }

    return ids;
  }, [dms.data]);

  // Partner profiles
  const partners = useProfiles(partnerIds);
  const partnerMap = useMemo(() => {
    if (!partners._exists) return {};

    const map: Record<string, Profile> = {};
    for (const p of partners.data)
      map[p.id] = p;

    return map;
  }, [partners.data]);

  // List of channels with extra data
  const channelData = useMemo<DmChannel[] | undefined>(() => {
    return dms.data?.map((ch) => {
      const partner = !ch.multi_member
        ? partnerMap[ch.members.find((m) => m !== session.profile_id) || '']
        : undefined;

      return {
        ...ch,
        name: partner?.username || ch.name,
        alias: partner?.username || ch.name || '',
        profile_picture: partner?.profile_picture,
        online: partner?.online,
      };
    });
  }, [dms.data, partnerMap]);

  // Current channel
  const channelId = app.new_private_channel ? null : app.private_channel;
  const channel = useMemo(() => {
    return channelData?.find((x) => x.id === channelId);
  }, [channelData, channelId]);

  return (
    <Flex
      sx={{
        flexGrow: 1,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <DmViewChannels dms={dms} channels={channelData} />

      <Flex
        direction='column'
        sx={(theme) => ({
          flexGrow: 1,
          width: 0, // idk why this works
          height: '100%',
          background: theme.other.colors.page,
        })}
      >
        <Group
          spacing={8}
          noWrap
          sx={(theme) => ({
            flexShrink: 0,
            height: '3.0rem',
            paddingLeft: '1.0rem',
            paddingRight: '0.3rem',
            borderBottom: `1px solid ${theme.other.colors.page_border}`,
          })}
        >
          {app.new_private_channel && (
            <ProfileAvatar
              profile={app.new_private_channel as ProfileWrapper}
              size={32}
            />
          )}
          {channel && (
            <Indicator
              inline
              position='bottom-end'
              offset={4}
              size={12}
              color='teal'
              withBorder
              disabled={!channel.online}
            >
              <MemberAvatar member={channel} size={32} />
            </Indicator>
          )}

          <Title order={4} ml={4} sx={{ lineHeight: 1 }}>
            {app.new_private_channel?.username || channel?.name}
          </Title>

          <div style={{ flexGrow: 1 }} />

          {rtc.joined && (
            <>
              <RtcControlBar />
              {!app.right_panel_opened && (
                <Divider orientation='vertical' m='0.5rem 0.0rem' />
              )}
            </>
          )}
        </Group>

        <ErrorBoundary>
          {(app.private_channel || app.new_private_channel) && (
            <Box
              sx={(theme) => ({
                position: 'relative',
                flex: '1 0 calc(100vh - 6.0rem)',
                width: '100%',
              })}
            >
              {dms._exists && (
                <DmMessageView key={channel?.id} channel={channel} dms={dms} />
              )}
            </Box>
          )}
        </ErrorBoundary>

        {!app.private_channel && (
          <Box
            sx={(theme) => ({
              flexGrow: 1,
              width: 0, // idk why this works
              height: '100%',
              background: theme.other.colors.page,
            })}
          />
        )}
      </Flex>
    </Flex>
  );
}
