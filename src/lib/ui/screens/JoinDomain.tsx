import { useEffect, useState } from 'react';

import {
  Button,
  Center,
  Paper,
  Space,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';

import DomainAvatar from '@/lib/ui/components/DomainAvatar';

import { useApp, useDomain, useProfile, useSession } from '@/lib/hooks';
import { socket } from '@/lib/utility/realtime';
import { Domain, ExpandedDomain, Member } from '@/lib/types';
import { api, withAccessToken } from '@/lib/api/utility';

import axios from 'axios';

////////////////////////////////////////////////////////////
interface Props {
  domain_id: string;
  onSubmit: () => void;
}

////////////////////////////////////////////////////////////
export default function JoinDomain(props: Props) {
  const app = useApp();
  const session = useSession();
  const profile = useProfile(session.profile_id);

  const [domain, setDomain] = useState<{ name: string; icon: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  // Check if user is already a member
  // TODO : Upgrade join system
  useEffect(() => {
    if (!profile._exists) return;
    api(
      'GET /domains/join/:join_id',
      {
        params: { join_id: props.domain_id },
      },
      { session },
    ).then((results) => {
      // Skip if already member
      if (results.is_member) props.onSubmit();
      else {
        setDomain({ name: results.name, icon: results.icon || '' });
      }
    });
  }, [profile._exists]);

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
    await profile._mutators.joinDomain(
      domain_id,
      values.alias || profile.username,
    );

    // TEMP : Reconnect to realtime server (in future, use socket.io to communicate new domain)
    socket().disconnect().connect();

    // Switch to it
    app._mutators.setDomain(domain_id);

    // Callback
    props.onSubmit();

    setLoading(false);
  }

  ////////////////////////////////////////////////////////////
  if (!domain) return null;

  ////////////////////////////////////////////////////////////
  return (
    <Center h='60vh'>
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
            <Stack align='center'>
              <DomainAvatar
                domain={domain as ExpandedDomain}
                size={96}
                color='#626771'
                sx={(theme) => ({
                  boxShadow: '0px 0px 16px #00000033',
                })}
              />

              <div>
                <Text size='xs' color='dimmed' align='center' mb={6}>
                  You have been invited to join
                </Text>
                <Title order={3} align='center'>
                  {domain.name}
                </Title>
              </div>
            </Stack>

            {/* <TextInput
              label='Alias'
              placeholder={profile.username}
              data-autofocus
              {...form.getInputProps('username')}
            /> */}

            <Space h={0} />
            <Button variant='gradient' type='submit' loading={loading}>
              Join
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
