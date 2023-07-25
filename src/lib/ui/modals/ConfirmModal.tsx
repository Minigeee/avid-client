import { createContext, PropsWithChildren, useContext, useRef, useState } from 'react';

import {
  Box,
  Button,
  Center,
  Group,
  MantineNumberSize,
  Modal,
  ModalProps,
  rem,
  Slider,
  Stack,
  Text,
  TextInput,
  useMantineTheme,
} from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE, FileWithPath } from '@mantine/dropzone';

import { IconPhoto, IconUpload, IconX } from '@tabler/icons-react';

import AvatarEditor from 'react-avatar-editor';
import { useElementSize } from '@mantine/hooks';


////////////////////////////////////////////////////////////
export type ConfirmModalProps = {
  /** The title of the modal */
  title: string;
  /** Modal content */
  content: JSX.Element;
  /** Props passed to modal component */
  modalProps?: Omit<ModalProps, 'opened' | 'onClose'>;
  /** The label shown on the confirm button */
  confirmLabel?: string;
  /** The label shown on the cancel button */
  cancelLabel?: string;
  /** The label above the type to confirm input */
  confirmText?: JSX.Element | string;
  /** Text the user must type to confirm action */
  typeToConfirm?: string;
  /** Function called when user cancels */
  onCancel?: () => void;
  /** Function called when user confirms */
  onConfirm?: () => Promise<void> | void;
};

/** Context menu context */
// @ts-ignore
export const ConfirmModalContext = createContext<{ setProps: (props: ConfirmModalProps | null) => void }>();


////////////////////////////////////////////////////////////
function ConfirmModalImpl(props: ConfirmModalProps & { setProps: (props: ConfirmModalProps | null) => void }) {
  const [loading, setLoading] = useState<boolean>(false);
  const [text, setText] = useState<string>('');

  return (
    <Modal
      title={props.title}
      yOffset='30vh'
      {...props.modalProps}
      opened
      onClose={() => props.setProps(null)}
      zIndex={201}
      onClick={(e) => e.stopPropagation()}
      overlayProps={{ zIndex: 202 }}
    >
      <Stack>
        {props.content}

        {props.typeToConfirm && (
          <Box>
            <Text size='sm'>{props.confirmText || 'Please type the name to confirm this action.'}</Text>
            <TextInput onChange={(e) => setText(e.currentTarget.value)} />
          </Box>
        )}

        <Group spacing='xs' position='right' mt={16}>
          <Button
            variant='default'
            onClick={(e) => props.setProps(null)}
          >
            {props.cancelLabel || 'Cancel'}
          </Button>
          <Button
            color='red'
            disabled={props.typeToConfirm !== undefined && text !== props.typeToConfirm}
            loading={loading}
            onClick={async (e) => {
              try {
                setLoading(true);
                await props.onConfirm?.();
              }
              finally {
                setLoading(false);
              }
              
              props.setProps(null);
            }}
          >
            {props.confirmLabel || 'Confirm'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

////////////////////////////////////////////////////////////
export default function ConfirmModal({ children }: PropsWithChildren) {
  const [props, setProps] = useState<ConfirmModalProps | null>(null);

  return (
    <ConfirmModalContext.Provider value={{ setProps }}>
      {props && <ConfirmModalImpl {...props} setProps={setProps} />}

      {children}
    </ConfirmModalContext.Provider>
  );
}


/** Hook for creating/opening image modal */
export function useConfirmModal() {
  const context = useContext(ConfirmModalContext);

  return {
    open: (props: ConfirmModalProps) => context.setProps(props),
  };
}