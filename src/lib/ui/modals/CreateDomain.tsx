import { ComponentPropsWithoutRef, forwardRef, useRef, useState } from 'react';

import {
  Box,
  Button,
  Center,
  Group,
  Slider,
  Stack,
  Text,
  TextInput,
  Title,
  useMantineTheme,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { ContextModalProps } from '@mantine/modals';
import { Dropzone, IMAGE_MIME_TYPE, FileWithPath } from '@mantine/dropzone';

import { IconPhoto, IconUpload, IconX } from '@tabler/icons-react';
import AvatarEditor from 'react-avatar-editor';

import config from '@/config';
import { ProfileWrapper } from '@/lib/hooks';
import { useElementSize } from '@mantine/hooks';

////////////////////////////////////////////////////////////
export type CreateDomainProps = {
  profile: ProfileWrapper;
  onCreate?: (domain_id: string) => any;
};

////////////////////////////////////////////////////////////
export default function CreateDomain({
  context,
  id,
  innerProps: props,
}: ContextModalProps<CreateDomainProps>) {
  const theme = useMantineTheme();

  const form = useForm({
    initialValues: {
      name: '',
    },
  });

  const { ref: stackRef, width: stackW } = useElementSize();
  const editorRef = useRef<AvatarEditor>(null);

  const [icon, setIcon] = useState<FileWithPath | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);

  const [loading, setLoading] = useState<boolean>(false);

  // TODO : Make better domain creation process:
  // - Domain picture
  // - Privacy settings
  // - Templates

  return (
    <form
      onSubmit={form.onSubmit(async (values) => {
        // Function for creating domain
        async function createDomain(icon?: { file: Blob; name: string }) {
          try {
            // Create domain
            const newProfile = await props.profile._mutators.addDomain(
              values.name,
              icon,
            );
            props.onCreate?.(newProfile?.domains.at(-1)?.id || '');
          } finally {
            // Close
            setLoading(false);
            context.closeModal(id);
          }
        }

        // Indicate loading
        setLoading(true);

        if (editorRef.current && icon) {
          const canvas = editorRef.current.getImageScaledToCanvas();

          // Convert to blob and upload
          canvas.toBlob((image) => {
            // Create domain with icon
            createDomain(image ? { file: image, name: icon.name } : undefined);
          }, icon.type);
        }

        // Create without icon
        else createDomain();
      })}
    >
      <Stack ref={stackRef} m={20}>
        <Title order={3} align="center">
          Create New Domain
        </Title>

        <TextInput
          label="Domain Name"
          placeholder="New Domain"
          required
          withAsterisk={false}
          data-autofocus
          {...form.getInputProps('name')}
        />

        <Box>
          <Text size="sm" weight={600} mb={6}>
            Domain Icon
          </Text>

          {!icon && (
            <Dropzone
              onDrop={(files) => setIcon(files[0])}
              onReject={(files) => console.log('rejected files', files)}
              accept={IMAGE_MIME_TYPE}
              maxSize={2 * 1024 ** 2}
            >
              <Center mih="10rem">
                <Stack
                  align="center"
                  spacing={8}
                  style={{ pointerEvents: 'none' }}
                >
                  <Dropzone.Accept>
                    <IconUpload
                      size="3.2rem"
                      strokeWidth={1.5}
                      color={
                        theme.colors[theme.primaryColor][
                          theme.colorScheme === 'dark' ? 4 : 6
                        ]
                      }
                    />
                  </Dropzone.Accept>
                  <Dropzone.Reject>
                    <IconX
                      size="3.2rem"
                      strokeWidth={1.5}
                      color={
                        theme.colors.red[theme.colorScheme === 'dark' ? 4 : 6]
                      }
                    />
                  </Dropzone.Reject>
                  <Dropzone.Idle>
                    <IconPhoto size="3.2rem" strokeWidth={1.5} />
                  </Dropzone.Idle>

                  <Text size="md" inline mt={16}>
                    Drop image here or click to browse
                  </Text>
                  <Text size="sm" color="dimmed" inline>
                    Image must not exceed 2MB
                  </Text>
                </Stack>
              </Center>
            </Dropzone>
          )}

          {icon && (
            <>
              <AvatarEditor
                ref={editorRef}
                image={icon}
                width={config.upload.profile_picture.image_size.w}
                height={config.upload.profile_picture.image_size.h}
                color={[0, 0, 0, 0.8]}
                scale={zoom}
                rotate={0}
                borderRadius={config.upload.profile_picture.image_size.w}
                disableBoundaryChecks
                style={{ width: stackW, height: stackW }}
              />

              <Text size="xs" weight={600} mt={4}>
                Zoom
              </Text>
              <Slider
                scale={(v) => v ** 3}
                min={0.5}
                max={3}
                step={0.001}
                label={null}
                marks={[
                  { value: 0.5, label: '-' },
                  { value: 3, label: '+' },
                ]}
                value={zoom}
                onChange={setZoom}
                styles={(theme) => ({
                  mark: { display: 'none' },
                  markLabel: {
                    marginTop: 2,
                    fontSize: theme.fontSizes.md,
                    color: theme.colors.dark[1],
                  },
                })}
              />
            </>
          )}
        </Box>

        <Button variant="gradient" type="submit" loading={loading} mt={16}>
          Create
        </Button>
      </Stack>
    </form>
  );
}
