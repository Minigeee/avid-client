import { useState } from 'react';

import {
  Button,
  Center,
  Paper,
  Space,
  Stack,
  Text,
  TextInput,
  Title
} from '@mantine/core';
import { useForm } from '@mantine/form';

import DomainAvatar from '@/lib/ui/components/DomainAvatar';

import { useApp, useDomain, useProfile, useSession } from '@/lib/hooks';
import { socket } from '@/lib/utility/realtime';


////////////////////////////////////////////////////////////
interface Props {
  domain_id: string;
  inviter_id?: string;
  onSubmit: () => void;
}

////////////////////////////////////////////////////////////
export default function JoinDomain(props: Props) {
  const app = useApp();
  const session = useSession();
  const profile = useProfile(session.profile_id);
  const inviter = useProfile(props.inviter_id ? `profiles:${props.inviter_id}` : undefined);
  const domain = useDomain(`domains:${props.domain_id}`);

  const [loading, setLoading] = useState(false);


  ////////////////////////////////////////////////////////////
  const form = useForm({
    initialValues: {
      alias: profile.username || '',
    },
  });

  
  ////////////////////////////////////////////////////////////
  async function onSubmit(values: typeof form.values) {
    if (!session._exists || !profile._exists) return;
    setLoading(true);

    // Make user join domain
    const domain_id = `domains:${props.domain_id}`;
    await profile._mutators.joinDomain(domain_id, values.alias || profile.username);

    // TEMP : Reconnect to realtime server (in future, use socket.io to communicate new domain)
    socket().disconnect().connect();

    // Switch to it
    app._mutators.navigation.setDomain(domain_id);

    // Callback
    props.onSubmit();

    setLoading(false);
  }

  
  ////////////////////////////////////////////////////////////
  if (!domain._exists || (props.inviter_id && !inviter._exists))
    return null;
  
  ////////////////////////////////////////////////////////////
  return (
    <Center h='60vh'>
      <Paper p={35} shadow='lg' sx={(theme) => ({
        width: '50ch',
        maxWidth: '100%',
        backgroundColor: theme.colors.dark[5],
      })}>
        <form onSubmit={form.onSubmit(onSubmit)}>
          <Stack>
            <Stack align='center'>
              <DomainAvatar
                domain={domain}
                size={96}
                color='#626771'
                sx={(theme) => ({
                  boxShadow: '0px 0px 16px #00000033',
                })}
              />

              <div>
                <Text size='xs' color='dimmed' align='center' mb={6}><b>{inviter.username}</b> has invited you to join</Text>
                <Title order={3} align='center'>{domain.name}</Title>
              </div>
            </Stack>

            <TextInput
              label='Alias'
              placeholder={profile.username}
              data-autofocus
              {...form.getInputProps('username')}
            />

            <Space h={0} />
            <Button
              variant='gradient'
              type='submit'
              loading={loading}
            >
              Join
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}