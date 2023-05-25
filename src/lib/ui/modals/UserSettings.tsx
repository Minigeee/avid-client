import { forwardRef, useEffect, useMemo, useState } from 'react';

import {
  Box,
  Button,
  Center,
  CloseButton,
  Divider,
  Flex,
  Group,
  ScrollArea,
  Select,
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
import { AppState, SessionState } from '@/lib/contexts';
import { ProfileWrapper, useApp, useMemoState, useProfile, useSession } from '@/lib/hooks';


////////////////////////////////////////////////////////////
const TABS = {
  'Account Settings': [
    { value: 'account', label: 'Account' },
  ],
  'App Settings': [
    { value: 'rtc', label: 'Voice & Video' },
  ],
};
let FLATTENED: { value: string; label: string }[] = [];
for (const tabs of Object.values(TABS))
  FLATTENED = FLATTENED.concat(tabs);

////////////////////////////////////////////////////////////
type TabProps = {
  app: AppState;
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
function RtcTab({ app, ...props }: TabProps) {
  const [rescan, setRescan] = useState<boolean>(false);
  const [audioInputDevices, setAudioInputDevices] = useState<{ value: string; label: string }[]>([]);

  // For populating media device lists
  useEffect(() => {
    function setMediaDevices() {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        // Check if any devices returned
        if (!devices.length) {
          if (!rescan) {
            // Request device access
            navigator.mediaDevices.getUserMedia({ audio: true });
            setRescan(!rescan);
          }

          return;
        }

        const audioInput: MediaDeviceInfo[] = [];
  
        // Iterate devices
        for (const device of devices) {
          if (device.kind == 'audioinput') {
            // If no label, request access
            if (!device.label) {
              navigator.mediaDevices.getUserMedia({ audio: true });
              setRescan(!rescan);
              return;
            }

            audioInput.push(device);
          }
        }
  
        // Set states
        setAudioInputDevices(audioInput
          .map(x => ({ value: x.deviceId, label: x.label.replace(/\([0-9a-fA-F]{4}:[0-9a-fA-F]{4}\)/g, '') }))
        );
      });
    }
    setMediaDevices();

    // Update whenever devices change
    navigator.mediaDevices.ondevicechange = (event) => {
      setMediaDevices();
    };

    // Reset handler on unload
    return () => {
      navigator.mediaDevices.ondevicechange = null;
    };
  }, [rescan]);


  return (
    <Stack>
      <Title order={3}>Audio Settings</Title>

      <Select
        label='Input Device'
        placeholder='None'
        data={audioInputDevices}
        value={app.rtc?.audio_input_device || 'default'}
        onChange={(value) => app._mutators.rtc.microphone.set_device(value || undefined)}
        sx={{ width: config.app.ui.med_input_width }}
        styles={{
          item: { whiteSpace: 'normal' },
        }}
      />
    </Stack>
  );
}


////////////////////////////////////////////////////////////
export type UserSettingsProps = {
  /** Used to modify app state */
  app: AppState;

  /** The starting tab */
  tab?: string;
};

////////////////////////////////////////////////////////////
export default function UserSettings({ context, id, innerProps: props }: ContextModalProps<UserSettingsProps>) {
  const session = useSession();
  const profile = useProfile(session.profile_id);

  const [tab, setTab] = useMemoState(() => {
    const tabId = props.tab || 'account';
    return FLATTENED.find(x => x.value === tabId);
  }, [props.tab]);


  if (!profile._exists) return null;
  const tabProps = { app: props.app, session, profile };

  return (
    <Flex w='100%' h='100%'>
      <Flex h='100%' direction='column' sx={(theme) => ({
        flexShrink: 0,
        backgroundColor: theme.colors.dark[6],
      })}>
        <SettingsMenu
          values={TABS}
          value={tab?.value || ''}
          onChange={(value, label) => setTab({ label, value })}
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
          <Title order={2}>{tab?.label}</Title>
          <div style={{ flexGrow: 1 }} />
          <CloseButton
            size='lg'
            iconSize={24}
            onClick={() => context.closeModal(id)}
          />
        </Flex>

        <ScrollArea sx={{ flexGrow: 1, padding: '1.0rem 1.5rem' }}>
          {tab?.value === 'account' && (<AccountTab {...tabProps} />)}
          {tab?.value === 'rtc' && (<RtcTab {...tabProps} />)}
        </ScrollArea>
      </Flex>
    </Flex>
  );
}