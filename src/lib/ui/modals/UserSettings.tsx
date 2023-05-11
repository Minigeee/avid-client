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
import { useForm } from '@mantine/form';
import { ContextModalProps, openConfirmModal } from '@mantine/modals';

import { Trash } from 'tabler-icons-react';

import { useImageModal } from '.';
import ActionButton from '@/lib/ui/components/ActionButton';
import ProfileAvatar from '@/lib/ui/components/ProfileAvatar';
import SettingsMenu from '@/lib/ui/components/SettingsMenu';

import config from '@/config';
import { getDomainCache } from '@/lib/db';
import { SessionState } from '@/lib/contexts';
import { ProfileWrapper, useProfile, useSession } from '@/lib/hooks';
import { errorWrapper } from '@/lib/utility/error-handler';

import axios from 'axios';


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


// This function changes profile pictures locally
async function _localSetProfilePicture(session: SessionState, profile: ProfileWrapper, newPictureUrl: string | null) {
  // Update locally
  profile._update({ ...profile, profile_picture: newPictureUrl }, false);

  // Change profile pictures of all domains that are loaded
  for (const d of profile.domains) {
    try {
      const cache = await getDomainCache(d.id, session, true);
      const obj = cache.cache._data[profile.id];
      if (obj?.data)
        obj.data.profile_picture = newPictureUrl;
    }
    catch (err) { }
  }
}

////////////////////////////////////////////////////////////
function AccountTab({ session, profile, ...props }: TabProps) {
  const { ImageModal, open: openImageModal } = useImageModal();

  return (
    <>
      <ImageModal
        subtext='Image must not exceed 2MB.'
        maxSize={2 * 1024 ** 2}
        imgSize={config.app.image_sizes.profile_picture}
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
                        sx: (theme) => ({
                          backgroundColor: theme.colors.red[6],
                          '&:hover': { backgroundColor: theme.colors.red[7] }
                        }),
                      },

                      // Optimistic mutation
                      onConfirm: () => {
                        // Remove profile picture
                        profile._mutators.removePicture(profile);
                      },
                    })
                  }}
                >
                  <Trash size={22} />
                </ActionButton>
              )}
            </Group>
            <Text size='xs' color='dimmed'>Profile pictures are resized to {config.app.image_sizes.profile_picture.w}x{config.app.image_sizes.profile_picture.h}</Text>
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
      <SettingsMenu
        values={TABS}
        value={tab.value}
        onChange={(label, value) => setTab({ label, value })}
        scrollAreaProps={{
          w: '30ch',
          pt: 10,
          sx: (theme) => ({
            flexShrink: 0,
            backgroundColor: theme.colors.dark[6],
          }),
        }}
      />

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