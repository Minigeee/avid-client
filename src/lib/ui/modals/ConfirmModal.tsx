import { createContext, PropsWithChildren, useContext, useRef, useState } from 'react';

import {
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
  useMantineTheme,
} from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE, FileWithPath } from '@mantine/dropzone';

import { IconPhoto, IconUpload, IconX } from '@tabler/icons-react';

import AvatarEditor from 'react-avatar-editor';
import { useElementSize } from '@mantine/hooks';


////////////////////////////////////////////////////////////
export type ConfirmModalProps = {
  /** Modal content */
  content: JSX.Element;
  /** Props passed to modal component */
  modalProps?: Omit<ModalProps, 'opened' | 'onClose'>;
  /** The label shown on the confirm button */
  confirmLabel?: string;
  /** The label shown on the cancel button */
  cancelLabel?: string;
  /** Function called when user cancels */
  onCancel?: () => void;
  /** Function called when user confirms */
  onConfirm?: () => void;
};

/** Context menu context */
// @ts-ignore
export const ConfirmModalContext = createContext<{ setProps: (props: ConfirmModalProps | null) => void }>();


////////////////////////////////////////////////////////////
export default function ConfirmModal({ children }: PropsWithChildren) {
  const [props, setProps] = useState<ConfirmModalProps | null>(null);

  return (
    <ConfirmModalContext.Provider value={{ setProps }}>
      {props && (
        <Modal
          {...props.modalProps}
          opened
          onClose={() => setProps(null)}
          zIndex={201}
          onClick={(e) => e.stopPropagation()}
          overlayProps={{ zIndex: 202 }}
        >
          <Stack>
            {props.content}

            <Group spacing='xs' position='right' mt={16}>
              <Button
                variant='default'
                onClick={(e) => setProps(null)}
              >
                {props.cancelLabel || 'Cancel'}
              </Button>
              <Button
                color='red'
                onClick={(e) => {
                  props.onConfirm?.();
                  setProps(null);
                }}
              >
                {props.confirmLabel || 'Confirm'}
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}

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