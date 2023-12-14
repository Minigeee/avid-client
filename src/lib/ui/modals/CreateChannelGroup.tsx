import { ComponentPropsWithoutRef, forwardRef, useMemo, useState } from 'react';

import {
  Box,
  Button,
  Divider,
  Flex,
  Group,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { ContextModalProps } from '@mantine/modals';

import { IconFolder } from '@tabler/icons-react';

import { DomainWrapper } from '@/lib/hooks';

////////////////////////////////////////////////////////////
export type CreateChannelGroupProps = {
  domain: DomainWrapper;
};

////////////////////////////////////////////////////////////
export default function CreateChannelGroup({
  context,
  id,
  innerProps: props,
}: ContextModalProps<CreateChannelGroupProps>) {
  const form = useForm({
    initialValues: {
      name: '',
      allow_everyone: true,
    },
  });

  const [loading, setLoading] = useState<boolean>(false);

  return (
    <form
      onSubmit={form.onSubmit(async (values) => {
        try {
          // Indicate loading
          setLoading(true);

          // Add group
          await props.domain._mutators.addGroup(
            values.name,
            values.allow_everyone,
          );

          context.closeModal(id);
        } finally {
          setLoading(false);
        }
      })}
    >
      <Stack>
        <TextInput
          label="Group Name"
          placeholder="New Group"
          icon={<IconFolder size={16} />}
          required
          withAsterisk={false}
          data-autofocus
          {...form.getInputProps('name')}
        />

        <Flex wrap="nowrap" gap="1.0rem" mt={8}>
          <Box sx={{ flexGrow: 1 }}>
            <Text size="sm" mb={4}>
              Allow <b>{'@everyone'}</b> to access this group
            </Text>
            <Text size="xs" color="dimmed">
              Enabling this will allow <b>@everyone</b> to access sections in
              this group. For more precise access control, disable this and add
              custom permissions for the roles that should have access to this
              group.
            </Text>
          </Box>

          <Switch
            {...form.getInputProps('allow_everyone', { type: 'checkbox' })}
          />
        </Flex>

        <Group spacing="xs" position="right" mt={16}>
          <Button variant="default" onClick={() => context.closeModal(id)}>
            Cancel
          </Button>
          <Button variant="gradient" type="submit" loading={loading}>
            Create
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
