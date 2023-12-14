import {
  PropsWithChildren,
  RefObject,
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSWRConfig } from 'swr';

import {
  ActionIcon,
  Box,
  Button,
  Center,
  CloseButton,
  ColorSwatch,
  Divider,
  Flex,
  Group,
  Popover,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
  useMantineTheme,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { ContextModalProps } from '@mantine/modals';

import {
  IconAt,
  IconBadgeOff,
  IconFolder,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';

import ActionButton from '@/lib/ui/components/ActionButton';
import ChannelIcon from '@/lib/ui/components/ChannelIcon';
import DataTable from '@/lib/ui/components/DataTable';
import { Emoji } from '@/lib/ui/components/Emoji';
import ProfileAvatar from '@/lib/ui/components/ProfileAvatar';
import PermissionSetting from '@/lib/ui/components/settings/PermissionSetting';
import { SettingsModal } from '@/lib/ui/components/settings/SettingsModal';

import config from '@/config';
import { AppState, SessionState } from '@/lib/contexts';
import {
  DomainWrapper,
  ProfileWrapper,
  canSetPermissions,
  hasPermission,
  setAclEntries,
  useAclEntries,
  useBoard,
  useCachedState,
  useDomain,
  useMemoState,
  useProfile,
  useSession,
} from '@/lib/hooks';
import {
  AclEntry,
  AllPermissions,
  Channel,
  ChannelGroup,
  Label,
  Role,
} from '@/lib/types';
import { diff } from '@/lib/utility';

////////////////////////////////////////////////////////////
type TabProps = {
  session: SessionState;
  domain: DomainWrapper;
  channel: Channel;
};

////////////////////////////////////////////////////////////
function BoardTab({ channel, ...props }: TabProps) {
  const board = useBoard((channel as Channel<'board'>).data?.board);
  console.log(board);

  const initialValues = useMemo(() => {
    const tagMap: Record<string, Label> = {};
    for (const tag of board.tags || []) tagMap[tag.id] = tag;

    return {
      prefix: board.prefix || '',
      tags: tagMap,
    };
  }, [board.prefix, board.tags]);
  const form = useForm({ initialValues });

  return (
    <>
      <TextInput
        label="Board Prefix"
        placeholder="PRFX"
        sx={{ width: config.app.ui.short_input_width }}
        {...form.getInputProps('prefix')}
        onChange={(e) => {
          if (e.target.value.length <= 5)
            form.setFieldValue('prefix', e.target.value.toLocaleUpperCase());
        }}
      />

      {board._exists && (
        <SettingsModal.Unsaved
          form={form}
          initialValues={initialValues}
          onSave={async () => {
            if (!board._exists) return;

            if (form.values.prefix !== initialValues.prefix)
              await board._mutators.setPrefix(form.values.prefix);
          }}
        />
      )}
    </>
  );
}

////////////////////////////////////////////////////////////
export type ChannelSettingsProps = {
  /** The id of the domain of the channel group */
  domain_id: string;
  /** The channel group to show settings for */
  channel: Channel;
  /** The starting tab */
  tab?: string;
};

////////////////////////////////////////////////////////////
export default function ChannelGroupSettings({
  context,
  id,
  innerProps: props,
}: ContextModalProps<ChannelSettingsProps>) {
  const session = useSession();
  const domain = useDomain(props.domain_id);

  // Tabs
  const tabs = useMemo(() => {
    let typeLabel = 'Text';
    if (props.channel.type === 'rtc') typeLabel = 'Voice & Video';
    else if (props.channel.type === 'board') typeLabel = 'Board';

    return {
      [`${domain.name} / ${props.channel.name}`]: [
        { value: 'type', label: typeLabel },
      ],
    };
  }, [domain.name, props.channel.name, props.channel.type]);

  if (!domain._exists) return null;
  const tabProps = { session, domain, channel: props.channel };

  return (
    <SettingsModal
      navkey={props.channel.id}
      tabs={tabs}
      defaultTab={props.tab}
      close={() => context.closeModal(id)}
    >
      <SettingsModal.Panel value="type">
        {props.channel.type === 'board' && <BoardTab {...tabProps} />}
      </SettingsModal.Panel>
    </SettingsModal>
  );
}
