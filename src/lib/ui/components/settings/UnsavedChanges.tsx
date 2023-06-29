import { RefObject, useState } from 'react';

import { Affix, Button, Group, Text, Transition } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';

import { IconAlertCircle } from '@tabler/icons-react';


////////////////////////////////////////////////////////////
type UnsavedChangesProps<T> = {
  bodyRef: RefObject<HTMLDivElement>;
  form: UseFormReturnType<T>;
  /** Need initial values bc form reset func doesn't used updated intial values */
  initialValues: T;
  onSubmit?: () => Promise<void>;
};

////////////////////////////////////////////////////////////
export default function UnsavedChanges<T>({ bodyRef, form, ...props }: UnsavedChangesProps<T>) {
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
              onClick={() => {
                form.setValues(props.initialValues);
                form.resetDirty(props.initialValues);
              }}
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