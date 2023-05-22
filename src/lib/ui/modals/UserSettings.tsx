import { useState } from 'react';

import {
  Box,
  Button,
  Center,
  CloseButton,
  Divider,
  Flex,
  Group,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title
} from '@mantine/core';
import { ContextModalProps, openConfirmModal } from '@mantine/modals';

import { IconTrash } from '@tabler/icons-react';

import { useImageModal } from '.';
import ActionButton from '@/lib/ui/components/ActionButton';
import ProfileAvatar from '@/lib/ui/components/ProfileAvatar';
import SettingsMenu from '@/lib/ui/components/SettingsMenu';

import config from '@/config';
import { SessionState } from '@/lib/contexts';
import { ProfileWrapper, useProfile, useSession } from '@/lib/hooks';


////////////////////////////////////////////////////////////
const TABS = {
  'Account Settings': [
    { value: 'account', label: 'Account' },
  ],
};

////////////////////////////////////////////////////////////
type TabProps = {
  session: SessionState;
  profile: ProfileWrapper;
};

////////////////////////////////////////////////////////////
function AccountTab({ session, profile, ...props }: TabProps) {
  const { ImageModal, open: openImageModal } = useImageModal();

  return (
    <>
      <ImageModal
        subtext='Image must not exceed 2MB.'
        maxSize={2 * 1024 ** 2}
        imgSize={config.upload.profile_picture.image_size}
        size='md'

        onUpload={(image, fname) => {
          if (image)
            profile._mutators.setPicture(image, fname);
        }}
      />

      <Stack>
        <Title order={3}>Profile Picture</Title>

        <Group spacing='xl' sx={(theme) => ({
          padding: '1.2rem',
          backgroundColor: theme.colors.dark[8],
          borderRadius: theme.radius.md,
        })}>
          <ProfileAvatar profile={profile} size={120} />
          <Stack spacing='sm'>
            <Group spacing='sm'>
              <Button
                variant='gradient'
                onClick={openImageModal}
              >
                {profile.profile_picture ? 'Change' : 'Upload'} Image
              </Button>

              {profile.profile_picture && (
                <ActionButton
                  tooltip='Remove Image'
                  tooltipProps={{ position: 'right' }}
                  size='lg'
                  sx={(theme) => ({
                    color: theme.colors.dark[1],
                    '&:hover': {
                      backgroundColor: theme.colors.dark[5],
                    },
                  })}
                  onClick={() => {
                    openConfirmModal({
                      title: 'Remove Profile Picture',
                      labels: { cancel: 'Cancel', confirm: 'Remove' },
                      children: 'Are you sure you want to remove your profile picture?',
                      groupProps: {
                        spacing: 'xs',
                        sx: { marginTop: '0.5rem' },
                      },
                      confirmProps: {
                        color: 'red',
                      },

                      // Optimistic mutation
                      onConfirm: () => {
                        // Remove profile picture
                        profile._mutators.removePicture(profile);
                      },
                    })
                  }}
                >
                  <IconTrash size={22} />
                </ActionButton>
              )}
            </Group>
            <Text size='xs' color='dimmed'>Profile pictures are resized to {config.upload.profile_picture.image_size.w}x{config.upload.profile_picture.image_size.h}</Text>
          </Stack>
        </Group>

        <Divider />
        <Title order={3}>Account Settings</Title>

        <TextInput
          label='Username'
          value={profile.username}
          disabled
          sx={{ width: config.app.ui.short_input_width }}
        />
      </Stack>
    </>
  );
}

////////////////////////////////////////////////////////////
export type UserSettingsProps = { };

////////////////////////////////////////////////////////////
export default function UserSettings({ context, id, innerProps: props }: ContextModalProps<UserSettingsProps>) {
  const session = useSession();
  const profile = useProfile(session.profile_id);

  const [tab, setTab] = useState(TABS['Account Settings'][0]);


  return (
    <Flex w='100%' h='100%'>
      <Flex h='100%' direction='column' sx={(theme) => ({
        flexShrink: 0,
        backgroundColor: theme.colors.dark[6],
      })}>
        <SettingsMenu
          values={TABS}
          value={tab.value}
          onChange={(label, value) => setTab({ label, value })}
          scrollAreaProps={{
            w: '30ch',
            pt: 10,
            sx: { flexGrow: 1 },
          }}
        />
        <Text size='xs' color='dimmed' ml={6} mb={2}>
          v{config.version.major}.{config.version.minor}.{config.version.patch}-r{config.version.revision}.{config.version.metadata.join('+')}
        </Text>
      </Flex>

      <Flex h='100%' direction='column' sx={(theme) => ({
        flexGrow: 1,
        backgroundColor: theme.colors.dark[7],
      })}>
        <Flex align='end' mb={4} sx={(theme) => ({
          padding: '1.0rem 1.5rem',
          borderBottom: `1px solid ${theme.colors.dark[5]}`,
        })}>
          <Title order={2}>{tab.label}</Title>
          <div style={{ flexGrow: 1 }} />
          <CloseButton
            size='lg'
            iconSize={24}
            onClick={() => context.closeModal(id)}
          />
        </Flex>

        {profile._exists && (
          <ScrollArea sx={{ flexGrow: 1, padding: '1.0rem 1.5rem' }}>
            {tab.value === 'account' && (<AccountTab session={session} profile={profile} />)}
          </ScrollArea>
        )}
      </Flex>
    </Flex>
  );
}