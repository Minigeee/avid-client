import { useRef, useState } from 'react';

import {
  Button,
  Center,
  Group,
  MantineNumberSize,
  Modal,
  rem,
  Slider,
  Stack,
  Text,
  useMantineTheme,
} from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE, FileWithPath } from '@mantine/dropzone';

import { IconPhoto, IconUpload, IconX } from '@tabler/icons-react';

import AvatarEditor from 'react-avatar-editor';
import { useElementSize } from '@mantine/hooks';

// TODO : Separate all image uploads by user (/images/profiles/{user_id}/{rand_id}.png)


////////////////////////////////////////////////////////////
export type ImageModalProps = {
  /** Text that is shown within the dropzone */
  description?: string;
  /** Text that is shown benezth the description in the dropzone */
  subtext?: string;
  /** The max size of the input image in bytes */
  maxSize?: number;

  /** Size of the modal during the edit image stage, size during the upload stage is controlled */
  size?: MantineNumberSize;
  /** The size of the output image in pixels */
  imgSize?: { w: number; h: number };
  /** Shape of the avatar editor border ("circle" by default) */
  shape?: 'circle' | 'rect';

  onUpload?: (image: Blob | null, fname: string) => void | Promise<void>;

  _opened: boolean;
  _setOpened: (opened: boolean) => void;
}

////////////////////////////////////////////////////////////
export default function ImageModal(props: ImageModalProps) {
  const theme = useMantineTheme();

  const editorRef = useRef<AvatarEditor | null>(null);
  const { ref: stackRef, width: stackW } = useElementSize();

  const [files, setFiles] = useState<FileWithPath[]>([]);
  const [zoom, setZoom] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(false);


  return (
    <Modal
      opened={props._opened}
      onClose={() => props._setOpened(false)}
      title={`${files.length > 0 ? 'Edit' : 'Upload'} Image`}
      size={files.length > 0 ? props.size || 'lg' : 'xl'}
      zIndex={201}
      overlayProps={{ zIndex: 202 }}
    >
      <Stack ref={stackRef}>
        {files.length === 0 && (
          <Dropzone
            onDrop={setFiles}
            onReject={(files) => console.log('rejected files', files)}
            accept={IMAGE_MIME_TYPE}
            maxSize={props.maxSize}

            mt={8}
          >
            <Group position='center' spacing='xl' style={{ minHeight: rem(220), pointerEvents: 'none' }}>
              <Dropzone.Accept>
                <IconUpload
                  size='3.2rem'
                  strokeWidth={1.5}
                  color={theme.colors[theme.primaryColor][theme.colorScheme === 'dark' ? 4 : 6]}
                />
              </Dropzone.Accept>
              <Dropzone.Reject>
                <IconX
                  size='3.2rem'
                  strokeWidth={1.5}
                  color={theme.colors.red[theme.colorScheme === 'dark' ? 4 : 6]}
                />
              </Dropzone.Reject>
              <Dropzone.Idle>
                <IconPhoto size='3.2rem' strokeWidth={1.5} />
              </Dropzone.Idle>

              <div>
                <Text size='lg' inline>
                  {props.description || 'Drop image here or click to browse'}
                </Text>
                <Text size='sm' color='dimmed' inline mt={7}>
                  {props.subtext}
                </Text>
              </div>
            </Group>
          </Dropzone>
        )}

        {files.length > 0 && (
          <Center mt={16} mb={8}>
            <Stack spacing={6}>
              <AvatarEditor
                ref={editorRef}
                image={files[0]}
                width={props.imgSize?.w || 512}
                height={props.imgSize?.h || 512}
                color={[0, 0, 0, 0.8]}
                scale={zoom}
                rotate={0}
                borderRadius={props.shape === 'rect' ? 0 : props.imgSize?.w}
                disableBoundaryChecks={props.shape !== 'rect'}
                style={{ width: stackW, height: stackW * (props.imgSize?.h || 512) / (props.imgSize?.w || 512) }}
              />

              <Text size='sm' weight={600} mt={8}>Zoom</Text>
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
            </Stack>
          </Center>
        )}

        <Group spacing='xs' position='right' mt={16}>
          <Button
            variant='default'
            onClick={() => props._setOpened(false)}
          >
            Cancel
          </Button>
          {files.length > 0 && (
            <Button
              variant='gradient'
              loading={loading}
              onClick={() => {
                if (!editorRef.current) return;

                const canvas = editorRef.current.getImageScaledToCanvas();

                // Convert to blob and upload
                setLoading(true);

                canvas.toBlob(async (image) => {
                  await props.onUpload?.(image, files[0].name);

                  setLoading(false);
                  props._setOpened(false);
                }, files[0].type);
              }}
            >
              Upload
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}


/** Hook for creating/opening image modal */
export function useImageModal() {
  const [opened, setOpened] = useState<boolean>(false);

  return {
    ImageModal: (props: Omit<ImageModalProps, '_opened' | '_setOpened'>) => ImageModal({ ...props, _opened: opened, _setOpened: setOpened }),
    open: () => setOpened(true),
    close: () => setOpened(false),
  };
}