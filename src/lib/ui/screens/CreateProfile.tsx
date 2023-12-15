import { useState } from 'react';
import axios from 'axios';

import { Button, Paper, Space, Stack, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';

import { useSession } from '@/lib/hooks';
import { createProfile } from '@/lib/api';

////////////////////////////////////////////////////////////
interface Props {
  title?: string;
}

////////////////////////////////////////////////////////////
export default function CreateProfile(props: Props) {
  const session = useSession();

  const [loading, setLoading] = useState(false);

  ////////////////////////////////////////////////////////////
  const form = useForm({
    initialValues: {
      username: '',
    },

    validate: {
      username: (value) =>
        value.length > 0 ? null : 'Please enter a username',
    },
  });

  ////////////////////////////////////////////////////////////
  async function onSubmit(values: typeof form.values) {
    if (!session._exists) return;
    setLoading(true);

    // Update profile, and make it current
    await createProfile(values.username, session);

    setLoading(false);
  }

  ////////////////////////////////////////////////////////////
  return (
    <Paper
      p={35}
      shadow='lg'
      sx={(theme) => ({
        width: '50ch',
        maxWidth: '100%',
        backgroundColor: theme.colors.dark[5],
      })}
    >
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack>
          <Title order={3} align='center'>
            {props.title || 'Create New Profile'}
          </Title>
          <TextInput
            label='Username'
            placeholder='None'
            data-autofocus
            {...form.getInputProps('username')}
          />

          <Space h={0} />
          <Button variant='gradient' type='submit' loading={loading}>
            Create
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}
