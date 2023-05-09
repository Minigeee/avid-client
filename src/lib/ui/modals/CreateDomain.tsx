import { ComponentPropsWithoutRef, forwardRef, useState } from 'react';

import {
  Button,
  Group,
  Stack,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { ContextModalProps } from '@mantine/modals';

import { ProfileWrapper, useApp } from '@/lib/hooks';


////////////////////////////////////////////////////////////
export type CreateDomainProps = {
  profile: ProfileWrapper;
  onCreate?: (domain_id: string) => any;
}

////////////////////////////////////////////////////////////
export default function CreateDomain({ context, id, innerProps: props }: ContextModalProps<CreateDomainProps>) {
  const form = useForm({
    initialValues: {
      name: '',
    },
  });

  const [loading, setLoading] = useState<boolean>(false);


  // TODO : Make better domain creation process:
  // - Domain picture
  // - Privacy settings
  // - Templates

  return (
    <form onSubmit={form.onSubmit(async (values) => {
      // Indicate loading
      setLoading(true);
      
      // Create domain
      const newProfile = await props.profile._mutators.addDomain(values.name);
      props.onCreate?.(newProfile?.domains.at(-1)?.id || '');
  
      // Close
      setLoading(false);
      context.closeModal(id);
    })}>
      <Stack p={20}>
        <Title order={3} align='center'>Create New Domain</Title>

        <TextInput
          label='Domain Name'
          placeholder='New Domain'
          required
          withAsterisk={false}
          data-autofocus
          {...form.getInputProps('name')}
        />

        <Button
          variant='gradient'
          type='submit'
          loading={loading}
          mt={16}
        >
          Create
        </Button>
      </Stack>
    </form>
  );
}