import { ComponentPropsWithoutRef, forwardRef, useCallback, useMemo, useRef, useState } from 'react';

import {
  ActionIcon,
  Box,
  Button,
  Checkbox,
  ColorInput,
  Divider,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { DatePickerInput, DateTimePicker, TimeInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { ContextModalProps } from '@mantine/modals';

import { IconClock, IconFolder, IconHash } from '@tabler/icons-react';

import PRESET_COLORS from '@/lib/ui/components/PresetColors';
import RichTextEditor from '@/lib/ui/components/rte/RichTextEditor';

import config from '@/config';
import { DomainWrapper } from '@/lib/hooks';
import { CalendarEvent, ChannelData, ChannelOptions, ChannelTypes } from '@/lib/types';

import moment from 'moment';


////////////////////////////////////////////////////////////
export type CreateCalendarEventProps = {
  /** Domain used for context / description box */
  domain?: DomainWrapper;

  /** Initial start date time */
  start?: Date;
  /** Initial end date time */
  end?: Date;
  /** Initial all day value */
  all_day?: boolean;

  /** Called when event is created */
  onCreate: (event: Omit<CalendarEvent, 'id' | 'time_created'>) => Promise<void>;
}

////////////////////////////////////////////////////////////
export default function CreateCalendarEvent({ context, id, innerProps: props }: ContextModalProps<CreateCalendarEventProps>) {
  const form = useForm({
    initialValues: {
      title: '',
      description: '',
      start: props.start || new Date(),
      end: props.end || (props.start || new Date()),
      all_day: props.all_day || false,
      color: PRESET_COLORS.at(-1),
    },
  });

  const startTimeRef = useRef<HTMLInputElement>(null);
  const endTimeRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState<boolean>(false);


  // Picker elements for start/end time inputs
  const pickerControls = useMemo(() => {
    return [
      (
        <ActionIcon variant="subtle" color="gray" onClick={() => startTimeRef.current?.showPicker()}>
          <IconClock style={{ width: '1rem', height: '1rem' }} stroke={1.5} />
        </ActionIcon>
      ),
      (
        <ActionIcon variant="subtle" color="gray" onClick={() => endTimeRef.current?.showPicker()}>
          <IconClock style={{ width: '1rem', height: '1rem' }} stroke={1.5} />
        </ActionIcon>
      ),
    ];
  }, []);

  // Duration text
  const durationText = useMemo(() => {
    const diffm = moment(form.values.end).diff(form.values.start, 'minutes');
    if (diffm <= 0) return form.values.all_day ? '0d' : '0h';

    if (form.values.all_day) {
      return `${Math.ceil(diffm / (24 * 60))}d`;
    }
    else {
      const h = Math.floor(diffm / 60);
      const m = diffm % 60;
      return `${h ? h + 'h' : ''} ${m ? m + 'm' : ''}`.trim();
    }
  }, [form.values.start, form.values.end, form.values.all_day]);

  // Called when form submitted
  const onSubmit = useCallback(async (values: typeof form.values) => {
    setLoading(true);

    try {
      // Callback
      await props.onCreate({
        title: values.title,
        start: values.start.toISOString(),
        end: values.end.toISOString(),
        all_day: values.all_day,
        color: values.color,
        description: values.description || undefined,
      });

      // Close modal
      context.closeModal(id);
    }
    catch (err) {
      throw err;
    }
    finally {
      setLoading(false);
    }
  }, [props.onCreate]);

  return (
    <form onSubmit={form.onSubmit(onSubmit)}>
      <Stack>
        <TextInput
          label='Title'
          placeholder='New Event'
          required
          withAsterisk={false}
          data-autofocus
          {...form.getInputProps('title')}
          sx={{ maxWidth: config.app.ui.med_input_width }}
        />

        <Box>
          <Text size='sm' weight={600}>
            Time{' '}
            <Text color='dimmed' span>
              {`(${durationText})`}
            </Text>
          </Text>
          <Group align='end' spacing='sm'>
            <DatePickerInput
              popoverProps={{ withinPortal: true }}
              sx={{ minWidth: '12rem' }}
              value={form.values.start}
              onChange={(value) => {
                if (!value) return;

                const newValue = new Date(form.values.start);
                newValue.setDate(value.getDate());
                newValue.setMonth(value.getMonth());
                newValue.setFullYear(value.getFullYear());

                form.setFieldValue('start', newValue);
              }}
            />

            {!form.values.all_day && (
              <>
                <TimeInput
                  ref={startTimeRef}
                  rightSection={pickerControls[0]}
                  value={`${form.values.start.getHours().toString().padStart(2, '0')}:${form.values.start.getMinutes().toString().padStart(2, '0')}`}
                  onChange={(ev) => {
                    const [h, m] = ev.target.value.split(':');

                    const newValue = new Date(form.values.start);
                    newValue.setHours(parseInt(h));
                    newValue.setMinutes(parseInt(m));

                    // Get duration to maintain
                    const s = moment(form.values.start);
                    const e = moment(form.values.end);
                    const dm = e.diff(s, 'minutes');

                    form.setFieldValue('start', newValue);
                    form.setFieldValue('end', moment(newValue).add(dm, 'minutes').toDate());
                  }}
                />
                <div style={{ marginBottom: '0.5rem', flexGrow: 0 }}>&ndash;</div>
                <TimeInput
                  ref={endTimeRef}
                  rightSection={pickerControls[1]}
                  value={`${form.values.end.getHours().toString().padStart(2, '0')}:${form.values.end.getMinutes().toString().padStart(2, '0')}`}
                  onChange={(ev) => {
                    const [h, m] = ev.target.value.split(':');

                    const newValue = new Date(form.values.end);
                    newValue.setHours(parseInt(h));
                    newValue.setMinutes(parseInt(m));

                    form.setFieldValue('end', newValue);
                  }}
                />
              </>
            )}

            {form.values.all_day && (
              <>
                <div style={{ marginBottom: '0.5rem', flexGrow: 0 }}>&ndash;</div>
                <DatePickerInput
                  popoverProps={{ withinPortal: true }}
                  sx={{ minWidth: '12rem' }}
                  value={form.values.end}
                  onChange={(value) => {
                    if (!value) return;

                    const newValue = new Date(form.values.end);
                    newValue.setDate(value.getDate());
                    newValue.setMonth(value.getMonth());
                    newValue.setFullYear(value.getFullYear());

                    form.setFieldValue('end', newValue);
                  }}
                />
              </>
            )}
          </Group>

          <Checkbox
            label='All Day'
            mt={8}
            {...form.getInputProps('all_day', { type: 'checkbox' })}
            onChange={(e) => {
              const checked = e.currentTarget.checked;

              // Reset end date
              if (!checked) {
                const newValue = new Date(form.values.end);
                newValue.setDate(form.values.start.getDate());
                newValue.setMonth(form.values.start.getMonth());
                newValue.setFullYear(form.values.start.getFullYear());

                form.setFieldValue('end', newValue);
              }

              form.setFieldValue('all_day', checked);
            }}
          />
        </Box>

        <ColorInput
          label='Color'
          swatches={PRESET_COLORS}
          swatchesPerRow={7}
          {...form.getInputProps('color')}
          sx={{ maxWidth: config.app.ui.med_input_width }}
        />

        <Divider />

        <Box>
          <Text size='sm' weight={600} sx={{ marginBottom: 5 }}>Description</Text>
          <RichTextEditor
            domain={props.domain}
            {...form.getInputProps('description')}
          />
        </Box>


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