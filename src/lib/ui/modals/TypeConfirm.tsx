import {
  ComponentPropsWithoutRef,
  PropsWithChildren,
  forwardRef,
  useMemo,
  useState,
} from 'react';

import {
  Box,
  Button,
  ButtonProps,
  Group,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { ContextModalProps } from '@mantine/modals';

////////////////////////////////////////////////////////////
export type TypeConfirmProps = PropsWithChildren & {
  /** Title of the modal */
  title?: string;
  /** The string the user must type to confirm action */
  confirm: string;
  /** The text shown above the text input */
  confirmText?: string;
  /** The confirm button label */
  confirmLabel?: string;
  /** Confirm button props */
  confirmBtnProps?: ButtonProps;
  /** Called when user confirms */
  onConfirm: () => void;
};

////////////////////////////////////////////////////////////
export default function TypeConfirm({
  context,
  id,
  innerProps: props,
}: ContextModalProps<TypeConfirmProps>) {
  const [text, setText] = useState<string>('');

  return (
    <Stack>
      {props.children}

      <Box>
        <Text size='sm'>
          {props.confirmText || 'Please type the name to confirm this action.'}
        </Text>
        <TextInput onChange={(e) => setText(e.currentTarget.value)} />
      </Box>

      <Group spacing='xs' position='right' mt={16}>
        <Button variant='default' onClick={() => context.closeModal(id)}>
          Cancel
        </Button>
        <Button
          color='red'
          {...props.confirmBtnProps}
          disabled={text !== props.confirm}
          onClick={() => {
            props.onConfirm();
            context.closeModal(id);
          }}
        >
          {props.confirmLabel || 'Delete'}
        </Button>
      </Group>
    </Stack>
  );
}
