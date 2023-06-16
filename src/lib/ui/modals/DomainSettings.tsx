import { RefObject, forwardRef, useEffect, useMemo, useRef, useState } from 'react';

import {
  ActionIcon,
  Affix,
  Box,
  Button,
  Center,
  CloseButton,
  ColorInput,
  ColorSwatch,
  DEFAULT_THEME,
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
  Transition,
  UnstyledButton
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { ContextModalProps, openConfirmModal } from '@mantine/modals';
import { UseFormReturnType } from '@mantine/form/lib/types';

import { IconAlertCircle, IconBadge, IconBadgeOff, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';

import { useImageModal } from '.';
import ActionButton from '@/lib/ui/components/ActionButton';
import DataTable from '@/lib/ui/components/DataTable';
import DomainAvatar from '@/lib/ui/components/DomainAvatar';
import { Emoji, EmojiPicker } from '@/lib/ui/components/Emoji';
import SettingsMenu from '@/lib/ui/components/SettingsMenu';

import config from '@/config';
import { AppState, SessionState } from '@/lib/contexts';
import { DomainWrapper, useApp, useDomain, useMemoState, useProfile, useSession } from '@/lib/hooks';
import { Role } from '@/lib/types';
import { diff } from '@/lib/utility';


////////////////////////////////////////////////////////////
const TABS = {
  'Domain Settings': [
    { value: 'general', label: 'General' },
    { value: 'roles', label: 'Roles' },
  ],
};
let FLATTENED: { value: string; label: string }[] = [];
for (const tabs of Object.values(TABS))
  FLATTENED = FLATTENED.concat(tabs);
  
////////////////////////////////////////////////////////////
const PRESET_COLORS: string[] = [];
for (const [name, colors] of Object.entries(DEFAULT_THEME.colors)) {
  if (name === 'red' || name === 'gray' || name === 'yellow' || name === 'lime')
    PRESET_COLORS.push(colors[7]);
  else if (name !== 'dark')
    PRESET_COLORS.push(colors[6]);
}
PRESET_COLORS.push(DEFAULT_THEME.colors.gray[6]);

////////////////////////////////////////////////////////////
type TabProps = {
  app: AppState;
  session: SessionState;
  domain: DomainWrapper;

  /** Modal body ref */
  bodyRef: RefObject<HTMLDivElement>;
};


////////////////////////////////////////////////////////////
type UnsavedChangesProps<T> = {
  bodyRef: RefObject<HTMLDivElement>;
  form: UseFormReturnType<T>;
  onSubmit?: () => Promise<void>;
};

////////////////////////////////////////////////////////////
function UnsavedChanges<T>({ bodyRef, form, ...props }: UnsavedChangesProps<T>) {
  const [loading, setLoading] = useState<boolean>(false);

  return (
    <Transition mounted={bodyRef.current !== null && form.isDirty()} transition='pop-bottom-right' duration={200}>
      {(styles) => (
        <Affix target={bodyRef.current || undefined} position={{ bottom: '0.75rem', right: '0.75rem' }}>
          <Group
            spacing={8}
            w='30rem'
            p='0.5rem 0.5rem 0.5rem 0.8rem'
            sx={(theme) => ({
              backgroundColor: theme.colors.dark[8],
              boxShadow: '0px 0px 12px #00000030',
              '.tabler-icon': { color: theme.colors.dark[4], marginBottom: 1 },
            })}
            style={styles}
          >
            <IconAlertCircle size='1.5rem' />
            <Text ml={4}>You have unsaved changes</Text>
            <div style={{ flexGrow: 1 }} />

            <Button
              variant='default'
              onClick={() => form.reset()}
            >
              Cancel
            </Button>
            <Button
              variant='gradient'
              loading={loading}
              onClick={async () => {
                if (!props.onSubmit) return;

                try {
                  setLoading(true);
                  await props.onSubmit();

                  // Reset dirty
                  form.resetDirty();
                }
                finally {
                  setLoading(false);
                }
              }}
            >
              Save
            </Button>
          </Group>
        </Affix>
      )}
    </Transition>
  );
}


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
function RolesTab({ domain, ...props }: TabProps) {
  // Settings form
  const form = useForm({
    initialValues: {
      roles: domain.roles.map(role => ({
        ...role,
        badge: role.badge || null,
        color: role.color || '',
      })),
    },
  });

  // Chosen role index
  const [roleIdx, setRoleIdx] = useState<number | null>(null);
  // Is badge picker open
  const [badgePickerOpen, setBadgePickerOpen] = useState<boolean>(false);


  // Current role
  const role = roleIdx !== null ? form.values.roles[roleIdx] : null;

  return (
    <>
      <Stack>
        <Text size='sm' color='dimmed' maw='100ch'>
          Roles are labels that can be assigned to members to indicate their designated position or responsibilities.
          Each role has a customizable set of permissions for precise control over their actions and access levels.
        </Text>

        <div>
          <Title order={3}>Roles</Title>
          <Text size='xs' color='dimmed'>
            Role tags and badges will be displayed in the order they appear in this list.
          </Text>
        </div>

        <Group maw='30rem' align='end' spacing='xs'>
          <TextInput
            placeholder='Search'
            icon={<IconSearch size={18} />}
            style={{ flexGrow: 1 }}
          />
          <Button
            variant='gradient'
          >
            New Role
          </Button>
        </Group>

        <ScrollArea.Autosize maw='30rem' sx={(theme) => ({
          padding: '0.5rem',
          backgroundColor: theme.colors.dark[8],
        })}>
          <Stack spacing={0}>
            {form.values.roles.map((role, idx) => (
              <UnstyledButton
                sx={(theme) => ({
                  padding: '0.4rem 0.6rem',
                  transition: 'background-color, 0.08s',

                  '&:hover': {
                    backgroundColor: theme.colors.dark[7],
                  },
                })}
                onClick={() => setRoleIdx(idx)}
              >
                <Group spacing='xs'>
                  <Box h='1.5rem' pt={2} sx={(theme) => ({ color: theme.colors.dark[3] })}>
                    {role.badge ? (<Emoji id={role.badge} size='1rem' />) : (<IconBadgeOff size={19} />)}
                  </Box>
                  <Text inline size='sm' weight={600} sx={{ flexGrow: 1 }}>
                    {role.id === domain._default_role ? '@' : ''}{role.label}
                  </Text>
                  {role.color && <ColorSwatch color={role.color} size='1.0rem' />}
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        </ScrollArea.Autosize>

        {role && (
          <>
            <Divider />

            <Title order={3}>Edit - {role.id === domain._default_role ? '@' : ''}{role.label}</Title>

            <TextInput
              label='Name'
              sx={{ width: config.app.ui.med_input_width }}
              {...form.getInputProps(`roles.${roleIdx}.label`)}
            />

            <ColorInput
              label='Color'
              description={`The role color affects the colored tags displayed in a user's profile`}
              placeholder='None'
              swatchesPerRow={7}
              swatches={PRESET_COLORS}
              styles={{ wrapper: { maxWidth: config.app.ui.med_input_width } }}
              {...form.getInputProps(`roles.${roleIdx}.color`)}
            />

            <div>
              <Text size='sm' weight={600}>Badge</Text>
              <Text size='xs' color='dimmed' mb={6}>
                A role badge is an icon displayed next to a user's names in chat
              </Text>

              <Group mt={8} spacing='sm'>
                <Center sx={(theme) => ({
                  height: '2.75rem',
                  width: '2.75rem',
                  backgroundColor: role.badge ? undefined : theme.colors.dark[8],
                  color: theme.colors.dark[3],
                  borderRadius: '3rem',
                })}>
                  {role.badge ? (<Emoji id={role.badge} size='2rem' />) : (<IconBadgeOff size='1.75rem' />)}
                </Center>

                <Popover
                  opened={badgePickerOpen}
                  withinPortal
                  withArrow
                  onClose={() => setBadgePickerOpen(false)}
                >
                  <Popover.Target>
                    <Button variant='default' ml={4} onClick={() => setBadgePickerOpen(!badgePickerOpen)}>
                      {role.badge ? 'Change' : 'Add'} Badge
                    </Button>
                  </Popover.Target>
                  <Popover.Dropdown p='0.75rem 1rem' sx={(theme) => ({
                    backgroundColor: theme.colors.dark[7],
                    borderColor: theme.colors.dark[5],
                    boxShadow: '0px 4px 16px #00000030',
                  })}>
                    <EmojiPicker
                      emojiSize={32}
                      onSelect={(emoji) => {
                        form.setFieldValue(`roles.${roleIdx}.badge`, emoji.id);
                        setBadgePickerOpen(false);
                      }}
                    />
                  </Popover.Dropdown>
                </Popover>

                {role.badge && (
                  <CloseButton
                    size='md'
                    onClick={() => form.setFieldValue(`roles.${roleIdx}.badge`, null)}
                  />
                )}
              </Group>
            </div>
          </>
        )}

      </Stack>

      <UnsavedChanges
        bodyRef={props.bodyRef}
        form={form}
        onSubmit={async () => {
          // Recreate original roles
          const original: Record<string, Role> = {};
          for (const role of domain.roles)
            original[role.id] = role;

          // Detect changes
          const unaccounted = new Set<string>(Object.keys(original));
          const changes: Record<string, Partial<Role>> = {};
          const newRoles: Record<string, Partial<Role>> = {};

          for (const role of form.values.roles) {
            if (!unaccounted.has(role.id))
              newRoles[role.id] = role;

            else {
              const newRole = { ...role, color: role.color || null };
              const roleDiff = diff(original[role.id], newRole);

              // Record diff
              if (roleDiff !== undefined)
                changes[role.id] = roleDiff;

              // Mark as accounted for
              unaccounted.delete(role.id);
            }
          }

          // The remaining values in unaccounted are deleted
          await domain._mutators.updateRoles({
            added: Object.values(newRoles),
            changed: changes,
            deleted: Array.from(unaccounted),
          });
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
export default function DomainSettings({ context, id, innerProps: props }: ContextModalProps<DomainSettingsProps>) {
  const app = useApp();
  const session = useSession();
  const domain = useDomain(props.domain_id);

  // Modal body
  const bodyRef = useRef<HTMLDivElement>(null);

  // Current tab
  const [tab, setTab] = useMemoState(() => {
    const tabId = props.tab || 'roles';
    return FLATTENED.find(x => x.value === tabId);
  }, [props.tab]);


  if (!domain._exists) return null;
  const tabProps = { app, session, domain, bodyRef };

  return (
    <Flex ref={bodyRef} w='100%' h='100%'>
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
          {tab?.value === 'roles' && (<RolesTab {...tabProps} />)}
        </ScrollArea>
      </Flex>
    </Flex>
  );
}