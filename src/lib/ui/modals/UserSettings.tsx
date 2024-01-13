import { forwardRef, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';

import {
  Box,
  Button,
  Center,
  CloseButton,
  Divider,
  Flex,
  Group,
  Image as MantineImage,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { ContextModalProps } from '@mantine/modals';

import { IconTrash } from '@tabler/icons-react';

import { useImageModal } from '.';
import { useConfirmModal } from './ConfirmModal';
import ActionButton from '@/lib/ui/components/ActionButton';
import ProfileAvatar from '@/lib/ui/components/ProfileAvatar';
import SettingsMenu from '@/lib/ui/components/settings/SettingsMenu';

import config from '@/config';
import { AppState, SessionState } from '@/lib/contexts';
import {
  CurrentProfileWrapper,
  ProfileWrapper,
  useApp,
  useCurrentProfile,
  useMemoState,
  useProfile,
  useRtc,
  useSession,
} from '@/lib/hooks';

////////////////////////////////////////////////////////////
const TABS = {
  'Account Settings': [{ value: 'account', label: 'Account' }],
  'App Settings': [{ value: 'rtc', label: 'Voice & Video' }],
  'Help & Feedback': [
    { value: 'contact', label: 'Contact' },
    { value: 'roadmap', label: 'Roadmap', link: '/roadmap' },
    { value: 'changelog', label: 'Changelog', link: '/changelog/latest' },
    {
      value: 'feedback',
      label: 'Feedback',
      link: config.app.contact.feedback_form,
    },
  ],
};
let FLATTENED: { value: string; label: string }[] = [];
for (const tabs of Object.values(TABS)) FLATTENED = FLATTENED.concat(tabs);

////////////////////////////////////////////////////////////
type TabProps = {
  app: AppState;
  session: SessionState;
  profile: CurrentProfileWrapper;
};

////////////////////////////////////////////////////////////
function AccountTab({ session, profile, ...props }: TabProps) {
  const { open: openConfirmModal } = useConfirmModal();
  const { ImageModal, open: openImageModal } = useImageModal();

  const [mode, setMode] = useState<'icon' | 'banner'>('icon');

  return (
    <>
      <ImageModal
        subtext={`Image must not exceed ${mode === 'icon' ? 3 : 5}MB.`}
        maxSize={(mode === 'icon' ? 3 : 5) * 1024 ** 2}
        imgSize={
          config.upload[mode === 'icon' ? 'profile_picture' : 'profile_banner']
            .image_size
        }
        shape={mode === 'icon' ? 'circle' : 'rect'}
        size={mode === 'icon' ? 'md' : 'xl'}
        onUpload={(image, fname) => {
          if (!image) return;
          if (mode === 'icon') profile._mutators.setPicture(image, fname);
          else profile._mutators.setBanner(image, fname);
        }}
      />

      <Stack>
        <Title order={3}>Profile Picture</Title>

        <Group
          spacing='xl'
          sx={(theme) => ({
            padding: '1.2rem',
            background: theme.other.elements.settings_panel,
            borderRadius: theme.radius.md,
          })}
        >
          <ProfileAvatar profile={profile} size={120} />
          <Stack spacing='sm'>
            <Group spacing='sm'>
              <Button
                variant='gradient'
                onClick={() => {
                  setMode('icon');
                  openImageModal();
                }}
              >
                {profile.profile_picture ? 'Change' : 'Upload'} Image
              </Button>

              {profile.profile_picture && (
                <ActionButton
                  tooltip='Remove Image'
                  tooltipProps={{ position: 'right' }}
                  size='lg'
                  sx={(theme) => ({
                    color: theme.other.elements.settings_panel_dimmed,
                    '&:hover': {
                      background: theme.other.elements.settings_panel_hover,
                    },
                  })}
                  onClick={() => {
                    openConfirmModal({
                      title: 'Remove Profile Picture',
                      confirmLabel: 'Remove',
                      content: (
                        <Text>
                          Are you sure you want to remove your profile picture?
                        </Text>
                      ),
                      // Optimistic mutation
                      onConfirm: () => {
                        // Remove profile picture
                        profile._mutators.removePicture(profile);
                      },
                    });
                  }}
                >
                  <IconTrash size={22} />
                </ActionButton>
              )}
            </Group>
            <Text size='xs' color='dimmed'>
              Profile pictures are resized to{' '}
              {config.upload.profile_picture.image_size.w}x
              {config.upload.profile_picture.image_size.h}
            </Text>
          </Stack>
        </Group>

        <Title order={3}>Profile Banner</Title>

        <Group
          spacing='xl'
          sx={(theme) => ({
            padding: '1.2rem',
            background: theme.other.elements.settings_panel,
            borderRadius: theme.radius.md,
          })}
        >
          {!profile.banner && (
            <MantineImage
              width='18.75rem'
              height='6rem'
              alt='Profile banner'
              withPlaceholder
              radius='sm'
            />
          )}
          {profile.banner && (
            <Image
              width={300}
              height={96}
              alt='Profile banner'
              src={profile.banner}
              style={{ borderRadius: '0.25rem' }}
            />
          )}

          <Stack spacing='sm'>
            <Group spacing='sm'>
              <Button
                variant='gradient'
                onClick={() => {
                  setMode('banner');
                  openImageModal();
                }}
              >
                {profile.banner ? 'Change' : 'Upload'} Image
              </Button>

              {profile.banner && (
                <ActionButton
                  tooltip='Remove Image'
                  tooltipProps={{ position: 'right' }}
                  size='lg'
                  sx={(theme) => ({
                    color: theme.other.elements.settings_panel_dimmed,
                    '&:hover': {
                      background: theme.other.elements.settings_panel_hover,
                    },
                  })}
                  onClick={() => {
                    openConfirmModal({
                      title: 'Remove Profile Banner',
                      confirmLabel: 'Remove',
                      content: (
                        <Text>
                          Are you sure you want to remove your profile banner?
                        </Text>
                      ),
                      // Optimistic mutation
                      onConfirm: () => {
                        // Remove profile banner
                        profile._mutators.removeBanner();
                      },
                    });
                  }}
                >
                  <IconTrash size={22} />
                </ActionButton>
              )}
            </Group>
            <Text size='xs' color='dimmed'>
              Profile banners are resized to{' '}
              {config.upload.profile_banner.image_size.w}x
              {config.upload.profile_banner.image_size.h}
            </Text>
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
  const rtc = useRtc();

  const [rescan, setRescan] = useState<boolean>(false);
  const [audioInputDevices, setAudioInputDevices] = useState<
    { value: string; label: string }[]
  >([]);
  const [videoInputDevices, setVideoInputDevices] = useState<
    { value: string; label: string }[]
  >([]);

  // For populating media device lists
  useEffect(() => {
    function setMediaDevices() {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        // Check if any devices returned
        if (!devices.length) {
          if (!rescan) {
            // Request device access
            navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            setRescan(!rescan);
          }

          return;
        }

        const audioInput: MediaDeviceInfo[] = [];
        const videoInput: MediaDeviceInfo[] = [];

        // Iterate devices
        for (const device of devices) {
          // If no label, request access
          if (!device.label) {
            navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            setRescan(!rescan);
            return;
          }

          // Mic
          if (device.kind == 'audioinput') audioInput.push(device);
          // Webcam
          else if (device.kind === 'videoinput') videoInput.push(device);
        }

        // Set states
        setAudioInputDevices(
          audioInput.map((x) => ({
            value: x.deviceId,
            label: x.label.replace(/\([0-9a-fA-F]{4}:[0-9a-fA-F]{4}\)/g, ''),
          })),
        );
        setVideoInputDevices(
          videoInput.map((x) => ({
            value: x.deviceId,
            label: x.label.replace(/\([0-9a-fA-F]{4}:[0-9a-fA-F]{4}\)/g, ''),
          })),
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
        label='Microphone'
        placeholder='None'
        data={audioInputDevices}
        value={rtc.audio_input_device || 'default'}
        onChange={(value) =>
          rtc._mutators.microphone.setDevice(value || undefined)
        }
        sx={{ width: config.app.ui.med_input_width }}
      />

      <Divider />
      <Title order={3}>Video Settings</Title>

      <Select
        label='Camera'
        placeholder='None'
        data={videoInputDevices}
        value={rtc.video_options?.device_id || videoInputDevices.at(0)?.value}
        onChange={(value) =>
          rtc._mutators.webcam.setOptions({
            ...rtc.video_options,
            device_id: value || undefined,
          })
        }
        sx={{ width: config.app.ui.med_input_width }}
      />
    </Stack>
  );
}

////////////////////////////////////////////////////////////
function ContactTab({ ...props }: TabProps) {
  return (
    <Stack spacing={6}>
      <Title order={5}>Email</Title>
      <Text>{config.app.contact.email}</Text>
    </Stack>
  );
}

////////////////////////////////////////////////////////////
export type UserSettingsProps = {
  /** The starting tab */
  tab?: string;
};

////////////////////////////////////////////////////////////
export default function UserSettings({
  context,
  id,
  innerProps: props,
}: ContextModalProps<UserSettingsProps>) {
  const app = useApp();
  const session = useSession();
  const profile = useCurrentProfile();

  const [tab, setTab] = useMemoState(() => {
    const tabId = props.tab || 'account';
    return FLATTENED.find((x) => x.value === tabId);
  }, [props.tab]);

  if (!profile._exists) return null;
  const tabProps = { app, session, profile };

  return (
    <Flex w='100%' h='100%'>
      <Flex
        h='100%'
        direction='column'
        sx={(theme) => ({
          flexShrink: 0,
          background: theme.other.elements.settings_tabs,
        })}
      >
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
          v{config.version.major}.{config.version.minor}.{config.version.patch}-
          {config.version.revision ? `r${config.version.revision}.` : ''}
          {config.version.metadata.join('+')}
        </Text>
      </Flex>

      <Flex
        h='100%'
        direction='column'
        sx={(theme) => ({
          flexGrow: 1,
          background: theme.other.elements.settings,
          color: theme.other.elements.settings_text,
        })}
      >
        <Flex
          align='end'
          mb={4}
          sx={(theme) => ({
            padding: '1.0rem 1.5rem',
            borderBottom: `1px solid ${theme.other.elements.settings_border}`,
          })}
        >
          <Title order={2}>{tab?.label}</Title>
          <div style={{ flexGrow: 1 }} />
          <CloseButton
            size='lg'
            iconSize={24}
            onClick={() => context.closeModal(id)}
          />
        </Flex>

        <ScrollArea sx={{ flexGrow: 1, padding: '1.0rem 1.5rem' }}>
          {tab?.value === 'account' && <AccountTab {...tabProps} />}
          {tab?.value === 'rtc' && <RtcTab {...tabProps} />}
          {tab?.value === 'contact' && <ContactTab {...tabProps} />}
        </ScrollArea>
      </Flex>
    </Flex>
  );
}
