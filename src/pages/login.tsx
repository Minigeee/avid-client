import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';

import {
  Alert,
  Button,
  Center,
  Divider,
  Stack,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, IconBrandGoogle, IconLock, IconMail } from '@tabler/icons-react';
import Head from 'next/head';


export default function Login() {
  const router = useRouter();
  const redirect = router.query.redirect ? `&redirect=${encodeURIComponent(router.query.redirect as string)}` : '';

  const form = useForm({
    initialValues: {
      alpha_key: '',
    }
  });


  return (
    <>
      <Head>
        <title>Avid | Login</title>
      </Head>
      <Center w='100vw' h='90vh'>
        <Stack spacing='xs' sx={(theme) => ({
          padding: '3.2rem 2.8rem',
          width: '50ch',
          maxWidth: '100%',
          backgroundColor: theme.colors.dark[5],
          borderRadius: theme.radius.sm,
          boxShadow: '0px 10px 20px #00000030',
        })}>
          <Title order={3} align='center'>Log In</Title>
          <TextInput
            label='Alpha Key'
            description='An alpha key is not needed if you already have an account'
            {...form.getInputProps('alpha_key')}
          />

          <Divider labelPosition='center' mt={8} mb={8} />

          <Alert icon={<IconAlertCircle size={18} />} color='yellow' mt={6} mb={8}>
            Email + password login isn&apos;t supported yet. Please use Google login for now.
          </Alert>

          <TextInput
            label='Email'
            placeholder='Email'
            icon={<IconMail size={18} />}
            disabled
          />
          <TextInput
            label='Password'
            placeholder='Password'
            icon={<IconLock size={18} />}
            type='password'
            disabled
          />

          <Button
            variant='gradient'
            mt={20}
          >
            Log In
          </Button>

          <Divider label='or' labelPosition='center' mt={8} mb={8} />

          <Button
            color='blue'
            leftIcon={<IconBrandGoogle size={18} strokeWidth={2} />}
            component='a'
            href={`/api/login?provider=google&alpha_key=${form.values.alpha_key}${redirect}`}
          >
            Continue with Google
          </Button>
        </Stack>
      </Center>
    </>
  )
}
