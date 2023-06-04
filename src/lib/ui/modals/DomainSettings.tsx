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
import DomainAvatar from '@/lib/ui/components/DomainAvatar';
import ProfileAvatar from '@/lib/ui/components/ProfileAvatar';
import SettingsMenu from '@/lib/ui/components/SettingsMenu';

import config from '@/config';
import { AppState, SessionState } from '@/lib/contexts';
import { DomainWrapper, useApp, useDomain, useMemoState, useProfile, useSession } from '@/lib/hooks';


////////////////////////////////////////////////////////////
const TABS = {
  'Domain Settings': [
    { value: 'general', label: 'General' },
  ],
};
let FLATTENED: { value: string; label: string }[] = [];
for (const tabs of Object.values(TABS))
  FLATTENED = FLATTENED.concat(tabs);

////////////////////////////////////////////////////////////
type TabProps = {
  app: AppState;
  session: SessionState;
  domain: DomainWrapper
};


////////////////////////////////////////////////////////////
function GeneralTab({ domain, ...props }: TabProps) {
  const profile = useProfile(props.session.profile_id);

  const { ImageModal, open: openImageModal } = useImageModal();

  return (
    <>
      <ImageModal
        subtext='Image must not exceed 2MB.'
        maxSize={2 * 1024 ** 2}
        imgSize={config.upload.profile_picture.image_size}
        size='md'

        onUpload={async (image, fname) => {
          if (image) {
            await domain._mutators.setIcon(image, fname);

            // Apply change to profile
            if (profile._exists)
              profile._refresh();
          }
        }}
      />

      <Stack>
        <Title order={3}>Domain Icon</Title>

        <Group spacing='xl' sx={(theme) => ({
          padding: '1.2rem',
          backgroundColor: theme.colors.dark[8],
          borderRadius: theme.radius.md,
        })}>
          <DomainAvatar domain={domain} size={120} />
          <Stack spacing='sm'>
            <Group spacing='sm'>
              <Button
                variant='gradient'
                onClick={openImageModal}
              >
                {domain.icon ? 'Change' : 'Upload'} Image
              </Button>

              {domain.icon && (
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
                      title: 'Remove Domain Icon',
                      labels: { cancel: 'Cancel', confirm: 'Remove' },
                      children: 'Are you sure you want to remove the domain icon picture?',
                      groupProps: {
                        spacing: 'xs',
                        sx: { marginTop: '0.5rem' },
                      },
                      confirmProps: {
                        color: 'red',
                      },

                      // Optimistic mutation
                      onConfirm: async () => {
                        // Remove domain icon picture
                        await domain._mutators.removeIcon();

                        // Apply change to profile
                        if (profile._exists)
                          profile._refresh();
                      },
                    })
                  }}
                >
                  <IconTrash size={22} />
                </ActionButton>
              )}
            </Group>
            <Text size='xs' color='dimmed'>Domain icons are resized to {config.upload.profile_picture.image_size.w}x{config.upload.profile_picture.image_size.h}</Text>
          </Stack>
        </Group>

        <Divider />
        <Title order={3}>Domain Settings</Title>

        <TextInput
          label='Domain Name'
          value={domain.name}
          disabled
          sx={{ width: config.app.ui.short_input_width }}
        />
      </Stack>
    </>
  );
}


////////////////////////////////////////////////////////////
export type DomainSettingsProps = {
  /** The id of the domain to show settings for */
  domain_id: string;
  /** The starting tab */
  tab?: string;
};

////////////////////////////////////////////////////////////
export default function DomainSettings({ context, id, innerProps: props }: ContextModalProps<DomainSettingsProps>) {
  const app = useApp();
  const session = useSession();
  const domain = useDomain(props.domain_id);

  const [tab, setTab] = useMemoState(() => {
    const tabId = props.tab || 'general';
    return FLATTENED.find(x => x.value === tabId);
  }, [props.tab]);


  if (!domain._exists) return null;
  const tabProps = { app, session, domain };

  return (
    <Flex w='100%' h='100%'>
      <SettingsMenu
        values={TABS}
        value={tab?.value || ''}
        onChange={(value, label) => setTab({ label, value })}
        scrollAreaProps={{
          w: '30ch',
          pt: 10,
          sx: (theme) => ({ backgroundColor: theme.colors.dark[6] }),
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
          <Title order={2}>{tab?.label}</Title>
          <div style={{ flexGrow: 1 }} />
          <CloseButton
            size='lg'
            iconSize={24}
            onClick={() => context.closeModal(id)}
          />
        </Flex>

        <ScrollArea sx={{ flexGrow: 1, padding: '1.0rem 1.5rem' }}>
          {tab?.value === 'general' && (<GeneralTab {...tabProps} />)}
        </ScrollArea>
      </Flex>
    </Flex>
  );
}