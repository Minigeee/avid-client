import { forwardRef, memo, useMemo, useState } from 'react';

import {
  Box,
  Center,
  CloseButton,
  Divider,
  Flex,
  Group,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import {
  IconHeadphonesOff,
  IconMessage,
  IconSearch,
  IconUsers,
} from '@tabler/icons-react';

import MessagesView from '@/lib/ui/views/chat/MessagesView';
import MemberAvatar from '@/lib/ui/components/MemberAvatar';
import MemberPopover from '@/lib/ui/components/MemberPopover';

import {
  DomainWrapper,
  hasPermission,
  useMember,
  useRtc,
  useSession,
} from '@/lib/hooks';
import { ExpandedMember, Member } from '@/lib/types';
import { RtcParticipant } from '@/lib/contexts';
import ProducerIcon from './components/ProducerIcon';
import assert from 'assert';
import { RtcContextMenu } from './components/RtcMenu';
import { ContextMenu } from '../../components/ContextMenu';

////////////////////////////////////////////////////////////
function _sortScore(participant: RtcParticipant | undefined) {
  if (!participant) return 0;

  let score = 0;

  if (participant.audio && !participant.audio.paused.remote) score += 2;
  else if (participant.video && !participant.video.paused.remote) score += 3;
  else if (participant.share && !participant.share.paused.remote) score += 4;

  return score;
}

////////////////////////////////////////////////////////////
type SidePanelViewProps = {
  channel_id: string;
  domain: DomainWrapper;
  participants: ExpandedMember[];
};

////////////////////////////////////////////////////////////
export default function SidePanelView(props: SidePanelViewProps) {
  const session = useSession();
  const rtc = useRtc();
  assert(rtc._exists);

  const self = useMember(props.domain.id, session.profile_id);

  const [tab, setTab] = useState<string | null>('chat');
  const [search, setSearch] = useState<string>('');

  // Filtered participants with self
  const participants = useMemo(() => {
    const lc = search.toLocaleLowerCase();

    const members = self._exists
      ? props.participants.concat([self])
      : props.participants;
    return members
      .filter((m) => m.alias.toLocaleLowerCase().indexOf(lc) >= 0)
      .map((m) => ({
        ...m,
        // @ts-ignore
        rtc:
          m.id === session.profile_id
            ? ({
                id: m.id,
                is_admin: true, // Doesn't matter, can't modify self anyways
                is_manager: true,
                volume: 0,
                locked: {
                  audio: rtc.is_mic_locked,
                  video: rtc.is_webcam_locked,
                  shared: rtc.is_share_locked,
                },
                audio: rtc.is_mic_enabled
                  ? {
                      paused: { remote: rtc.is_mic_muted },
                    }
                  : undefined,
                video: rtc.is_webcam_enabled
                  ? {
                      paused: { remote: false },
                    }
                  : undefined,
                share: rtc.is_screen_shared
                  ? {
                      paused: { remote: false },
                    }
                  : undefined,
                is_deafened: rtc.is_deafened,
              } as RtcParticipant)
            : rtc.participants?.[m.id],
      }))
      .sort((a, b) => {
        const diff = _sortScore(b.rtc) - _sortScore(a.rtc);
        return diff || a.alias.localeCompare(b.alias);
      });
  }, [
    props.participants,
    self,
    search,
    rtc.participants,
    rtc.is_mic_enabled,
    rtc.is_mic_muted,
    rtc.is_webcam_enabled,
    rtc.is_screen_shared,
    rtc.is_mic_locked,
    rtc.is_webcam_locked,
    rtc.is_share_locked,
  ]);

  // Member item
  const MemberListItem = useMemo(() => {
    const component = memo(
      forwardRef<
        HTMLDivElement,
        { member: ExpandedMember & { rtc: RtcParticipant | undefined } }
      >(({ member, ...others }, ref) => {
        let alias = member.alias.replace(/<[^>]*>/g, '');
        if (search.length > 0) {
          const idx = alias
            .toLocaleLowerCase()
            .indexOf(search.toLocaleLowerCase());
          if (idx >= 0)
            alias = `${alias.slice(0, idx)}<b>${alias.slice(
              idx,
              idx + search.length,
            )}</b>${alias.slice(idx + search.length)}`;
        }

        // Rtc stuff
        const rtcInfo = member.rtc;
        const canManage =
          !rtcInfo?.is_admin &&
          (props.domain._permissions.is_admin ||
            (hasPermission(
              props.domain,
              props.channel_id,
              'can_manage_participants',
            ) &&
              !rtcInfo?.is_manager));

        return (
          <MemberPopover
            domain={props.domain}
            member={member}
            popoverProps={{ position: 'left-start' }}
            withinPortal
          >
            <ContextMenu.Trigger
              context={{ member }}
              disabled={member.id === session.profile_id}
            >
              <UnstyledButton
                sx={(theme) => ({
                  padding: '0rem 0.5rem',
                  width: '100%',
                  borderRadius: theme.radius.sm,
                  '&:hover': {
                    backgroundColor: theme.colors.dark[6],
                  },
                })}
              >
                <Flex
                  ref={ref}
                  {...others}
                  gap={6}
                  wrap="nowrap"
                  align="center"
                  sx={{
                    height: '2.6rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <MemberAvatar size={32} member={member} />
                  <Text
                    ml={6}
                    size="sm"
                    weight={search.length > 0 ? 400 : 600}
                    sx={(theme) => ({
                      flexGrow: 1,
                      color: theme.colors.gray[4],
                    })}
                    dangerouslySetInnerHTML={{ __html: alias }}
                  />

                  {rtcInfo && (
                    <Group spacing={2} onClick={(e) => e.stopPropagation()}>
                      {((rtcInfo.share && !rtcInfo.share.paused.remote) ||
                        rtcInfo.locked.share) && (
                        <ProducerIcon
                          participant={rtcInfo}
                          type="share"
                          rtc={rtc}
                          canManage={canManage}
                        />
                      )}
                      {((rtcInfo.video && !rtcInfo.video.paused.remote) ||
                        rtcInfo.locked.video) && (
                        <ProducerIcon
                          participant={rtcInfo}
                          type="video"
                          rtc={rtc}
                          canManage={canManage}
                        />
                      )}
                      {((rtcInfo.audio && !rtcInfo.audio.paused.remote) ||
                        rtcInfo.locked.audio) && (
                        <ProducerIcon
                          participant={rtcInfo}
                          type="audio"
                          rtc={rtc}
                          canManage={canManage}
                        />
                      )}

                      {rtcInfo.is_deafened && (
                        <Center w={28} h={28}>
                          <IconHeadphonesOff size={19} />
                        </Center>
                      )}
                    </Group>
                  )}
                </Flex>
              </UnstyledButton>
            </ContextMenu.Trigger>
          </MemberPopover>
        );
      }),
    );
    component.displayName = 'MemberListItem';

    return component;
  }, [search, props.channel_id, props.domain._permissions]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexFlow: 'column',
        height: '100%',
      }}
    >
      <Group
        sx={(theme) => ({
          flexShrink: 0,
          height: '2.9rem',
          paddingTop: '0.2rem',
          paddingLeft: '0.3rem',
          borderBottom: `1px solid ${theme.colors.dark[6]}`,
        })}
      >
        <Tabs
          value={tab}
          onTabChange={setTab}
          variant="pills"
          color="dark"
          styles={(theme) => ({
            tab: {
              color: theme.colors.dark[1],
              fontWeight: 600,
              transition: 'background-color 0.1s',

              '&:hover': {
                backgroundColor: theme.colors.dark[6],
              },
              '&[data-active]': {
                backgroundColor: theme.colors.dark[6],
                '&:hover': {
                  backgroundColor: theme.colors.dark[6],
                },
              },
            },
          })}
        >
          <Tabs.List>
            <Tabs.Tab value="chat" icon={<IconMessage size={16} />}>
              Chat
            </Tabs.Tab>
            <Tabs.Tab value="participants" icon={<IconUsers size={16} />}>
              Participants
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Group>

      {tab === 'chat' && (
        <Box
          sx={{
            flexGrow: 1,
            height: 0,
          }}
        >
          <MessagesView
            channel_id={props.channel_id}
            domain={props.domain}
            p="1.2rem"
            pb="1.5rem"
            avatarGap="md"
            withSidePanel={false}
          />
        </Box>
      )}

      {tab === 'participants' && (
        <>
          <TextInput
            m={8}
            placeholder="Search participants"
            icon={<IconSearch size={18} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            rightSection={
              search.length > 0 ? (
                <CloseButton onClick={() => setSearch('')} />
              ) : undefined
            }
          />

          <Divider
            sx={(theme) => ({
              color: theme.colors.dark[5],
              borderColor: theme.colors.dark[5],
            })}
          />

          <RtcContextMenu domain={props.domain}>
            <ScrollArea p={8} sx={{ flexGrow: 1 }}>
              <Stack spacing={0}>
                {participants.map((member, i) => (
                  <MemberListItem key={member.id} member={member} />
                ))}
              </Stack>
            </ScrollArea>
          </RtcContextMenu>
        </>
      )}
    </Box>
  );
}
