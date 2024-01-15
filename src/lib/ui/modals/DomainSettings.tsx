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
import { ContextModalProps } from '@mantine/modals';
import { useForm } from '@mantine/form';

import { IconTrash } from '@tabler/icons-react';

import { useImageModal } from '.';
import { useConfirmModal } from './ConfirmModal';
import ActionButton from '@/lib/ui/components/ActionButton';
import DomainAvatar from '@/lib/ui/components/DomainAvatar';
import { RolesTab } from '@/lib/ui/components/settings/domain/RolesTab';
import { SettingsModal } from '@/lib/ui/components/settings/SettingsModal';

import config from '@/config';
import { SessionState } from '@/lib/contexts';
import { DomainWrapper, useCurrentProfile, useDomain, useProfile, useSession } from '@/lib/hooks';
import { diff } from '@/lib/utility';

////////////////////////////////////////////////////////////
type TabProps = {
  session: SessionState;
  domain: DomainWrapper;
};

////////////////////////////////////////////////////////////
function GeneralTab({ domain, ...props }: TabProps) {
  const profile = useCurrentProfile();

  const { open: openConfirmModal } = useConfirmModal();
  const { ImageModal, open: openImageModal } = useImageModal();

  // Form
  const initialValues = useMemo(() => {
    return {
      name: domain.name,
    };
  }, [domain.name]);
  const form = useForm({ initialValues });

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
            if (profile._exists) profile._refresh();
          }
        }}
      />

      <Title order={3}>{config.text.domain.base} Icon</Title>

      <Group
        spacing='xl'
        sx={(theme) => ({
          padding: '1.2rem',
          background: theme.other.elements.settings_panel,
          borderRadius: theme.radius.md,
        })}
      >
        <DomainAvatar domain={domain} size={120} />
        <Stack spacing='sm'>
          <Group spacing='sm'>
            <Button variant='gradient' onClick={openImageModal}>
              {domain.icon ? 'Change' : 'Upload'} Image
            </Button>

            {domain.icon && (
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
                    title: `Remove ${config.text.domain.base} Icon`,
                    confirmLabel: 'Remove',
                    content: (
                      <Text>
                        Are you sure you want to remove the{' '}
                        {config.text.domain.base_lc} icon picture?
                      </Text>
                    ),
                    // Optimistic mutation
                    onConfirm: async () => {
                      // Remove domain icon picture
                      await domain._mutators.removeIcon();

                      // Apply change to profile
                      if (profile._exists) profile._refresh();
                    },
                  });
                }}
              >
                <IconTrash size={22} />
              </ActionButton>
            )}
          </Group>
          <Text
            size='xs'
            sx={(theme) => ({
              color: theme.other.elements.settings_panel_dimmed,
            })}
          >
            {config.text.domain.base} icons are resized to{' '}
            {config.upload.profile_picture.image_size.w}x
            {config.upload.profile_picture.image_size.h}
          </Text>
        </Stack>
      </Group>

      <Divider />
      <Title order={3}>{config.text.domain.base} Settings</Title>

      <TextInput
        label='Name'
        {...form.getInputProps('name')}
        sx={{ width: config.app.ui.short_input_width }}
      />

      <SettingsModal.Unsaved
        form={form}
        initialValues={initialValues}
        onSave={async () => {
          const d = diff(initialValues, form.values);
          if (d?.name) domain._mutators.rename(d.name);
        }}
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
export default function DomainSettings({
  context,
  id,
  innerProps: props,
}: ContextModalProps<DomainSettingsProps>) {
  const session = useSession();
  const domain = useDomain(props.domain_id);

  // Tabs
  const tabs = useMemo(
    () => ({
      [domain.name || '_']: [
        { value: 'general', label: 'General' },
        { value: 'roles', label: 'Roles' },
      ],
    }),
    [domain.name],
  );

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
