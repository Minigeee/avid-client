import { ComponentPropsWithoutRef, forwardRef, useState } from 'react';

import {
  Button,
  Divider,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { ContextModalProps } from '@mantine/modals';

import { IconHash } from '@tabler/icons-react';

import ChannelIcon from '@/lib/ui/components/ChannelIcon';

import { DomainWrapper } from '@/lib/hooks';
import { ChannelData, ChannelOptions, ChannelTypes } from '@/lib/types';


////////////////////////////////////////////////////////////
interface TypeSelectItemProps extends ComponentPropsWithoutRef<'div'> {
  value: ChannelTypes;
  label: string;
  group: string;
  description: string;
  disabled: boolean;
}

////////////////////////////////////////////////////////////
const TypeSelectItem = forwardRef<HTMLDivElement, TypeSelectItemProps>(
  ({ value, label, group, description, disabled, ...others }: TypeSelectItemProps, ref) => (
    <div ref={ref} {...others}>
      <Group noWrap>
        <ChannelIcon type={value} size={20} />

        <div>
          <Text size='sm' weight={500}>{label}</Text>
          <Text size='xs' color='dimmed'>
            {description}
          </Text>
          {disabled && (
            <Text size='xs' mt={6} sx={(theme) => ({ color: theme.colors.dark[0] })}>
              Please enable the <b>{group}</b> extension to use this channel type
            </Text>
          )}
        </div>
      </Group>
    </div>
  )
);


////////////////////////////////////////////////////////////
export type CreateChannelProps = {
  domain: DomainWrapper;
}

////////////////////////////////////////////////////////////
export default function CreateChannel({ context, id, innerProps: props }: ContextModalProps<CreateChannelProps>) {
  const form = useForm({
    initialValues: {
      name: '',
      type: 'text' as ChannelTypes,

      rtc_max_participants: 50,

      board_prefix: '',
    },
  });

  const [loading, setLoading] = useState<boolean>(false);

  const extraSettings =
    form.values.type === 'rtc' ||
    form.values.type === 'board';


  ////////////////////////////////////////////////////////////
  const CHANNEL_TYPES = [
    {
      value: 'text',
      label: 'Text',
      group: 'General',
      description: 'Communicate using messages, images, and emojis',
      disabled: false,
    },
    {
      value: 'rtc',
      label: 'Voice & Video',
      group: 'General',
      description: 'Chat with other members through voice, video, and screen share',
      disabled: false,
    },
    {
      value: 'board',
      label: 'Board',
      group: 'Project',
      description: 'Create to-do lists and roadmaps to plan and organize large-scale projects',
      disabled: false,
    },
  ];


  async function submit() {
    if (!props.domain._exists) return;

    // Indicate loading
    setLoading(true);

    const { name, type } = form.values;

    // Compile extra required data
    let data: ChannelData<ChannelTypes> | undefined;
    let options: ChannelOptions<ChannelTypes> | undefined;

    if (type === 'rtc') {
      data = { max_participants: form.values.rtc_max_participants };
    }
    else if (type === 'board') {
      options = { prefix: form.values.board_prefix };
    }

    // Add channel
    await props.domain._mutators.addChannel(name, type, data, options);

    // Close
    setLoading(false);
    context.closeModal(id);
  }


  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack>
        <TextInput
          label='Channel Name'
          placeholder='channel-name'
          icon={<IconHash size={16} />}
          required
          withAsterisk={false}
          data-autofocus
          {...form.getInputProps('name')}
        />
        <Select
          label='Channel Type'
          data={CHANNEL_TYPES}
          icon={<ChannelIcon type={form.values.type} size={16} />}
          itemComponent={TypeSelectItem}
          withinPortal
          styles={(theme) => ({
            input: {
              fontWeight: 500,
            },
          })}
          {...form.getInputProps('type')}
        />

        {extraSettings && <Divider />}

        {form.values.type === 'rtc' && (
          <>
            <NumberInput
              label='Max Participants'
              description='The maximum allowed number of concurrent participants'
              required
              withAsterisk={false}
              min={2}
              max={50}
              {...form.getInputProps('rtc_max_participants')}
            />
          </>
        )}

        {form.values.type === 'board' && (
          <>
            <TextInput
              label='Board Prefix'
              description='A short prefix used to generate IDs for tasks (max 5 characters)'
              placeholder='PRFX'
              required
              withAsterisk={false}
              {...form.getInputProps('board_prefix')}
              onChange={(e) => {
                if (e.target.value.length <= 5)
                  form.setFieldValue('board_prefix', e.target.value.toLocaleUpperCase());
              }}
            />
          </>
        )}

        <Group spacing='xs' position='right' mt={16}>
          <Button
            variant='default'
            onClick={() => context.closeModal(id)}
          >
            Cancel
          </Button>
          <Button
            variant='gradient'
            type='submit'
            loading={loading}
          >
            Create
          </Button>
        </Group>
      </Stack>
    </form>
  );
}