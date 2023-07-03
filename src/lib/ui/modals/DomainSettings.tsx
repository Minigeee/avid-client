import { useMemo } from 'react';

import {
  Button,
  Divider,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { ContextModalProps, openConfirmModal } from '@mantine/modals';

import { IconTrash } from '@tabler/icons-react';

import { useImageModal } from '.';
import ActionButton from '@/lib/ui/components/ActionButton';
import DomainAvatar from '@/lib/ui/components/DomainAvatar';
import { RolesTab } from '@/lib/ui/components/settings/domain/RolesTab';
import { SettingsModal } from '@/lib/ui/components/settings/SettingsModal';

import config from '@/config';
import { SessionState } from '@/lib/contexts';
import { DomainWrapper, useDomain, useProfile, useSession } from '@/lib/hooks';


////////////////////////////////////////////////////////////
type TabProps = {
  session: SessionState;
  domain: DomainWrapper;
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
  const session = useSession();
  const domain = useDomain(props.domain_id);

  // Tabs
  const tabs = useMemo(() => ({
    [domain.name || '_']: [
      { value: 'general', label: 'General' },
      { value: 'roles', label: 'Roles' },
    ],
  }), [domain.name]);


  if (!domain._exists) return null;
  const tabProps = { session, domain };

  return (
    <SettingsModal
      navkey={props.domain_id}
      tabs={tabs}
      defaultTab={props.tab}
      close={() => context.closeModal(id)}
    >
      <SettingsModal.Panel value='general'>
        <GeneralTab {...tabProps} />
      </SettingsModal.Panel>
      <SettingsModal.Panel value='roles'>
        <RolesTab {...tabProps} />
      </SettingsModal.Panel>
    </SettingsModal>
  );
}