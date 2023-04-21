import { useState } from 'react';
import axios from 'axios';

import {
  Button,
  Paper,
  Space,
  Stack,
  TextInput,
  Title
} from '@mantine/core';
import { useForm } from '@mantine/form';

import { useSession } from '@/lib/hooks';
import { useProfilesDb } from '@/lib/db';

import { verify } from 'jsonwebtoken';


////////////////////////////////////////////////////////////
interface Props {
  title?: string;
}

////////////////////////////////////////////////////////////
export default function CreateProfile(props: Props) {
  const session = useSession();
  const profiles = useProfilesDb();

  const [loading, setLoading] = useState(false);


  ////////////////////////////////////////////////////////////
  const form = useForm({
    initialValues: {
      username: ''
    },

    validate: {
      username: (value) => value.length > 0 ? null : 'Please enter a username',
    }
  });

  
  ////////////////////////////////////////////////////////////
  async function onSubmit(values: typeof form.values) {
    if (!session._exists) return;
    setLoading(true);

    // Update profile, and make it current
    const profile_id = await profiles.create(session.user_id, values.username, true);

    // Update session with new profile
    if (profile_id)
      // Force refresh because new user object will have current profile
      session.refresh(true);

    setLoading(false);
  }

  
  ////////////////////////////////////////////////////////////
  return (
    <Paper p={35} shadow='lg' sx={(theme) => ({
      width: '50ch',
      maxWidth: '100%',
      backgroundColor: theme.colors.dark[5],
    })}>
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack>
          <Title order={3} align='center'>{props.title || 'Create New Profile'}</Title>
          <TextInput
            label='Username'
            placeholder='None'
            {...form.getInputProps('username')}
          />

          <Space h={0} />
          <Button
            variant='gradient'
            type='submit'
            loading={loading}
          >
            Create
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}