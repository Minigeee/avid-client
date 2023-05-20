import { ComponentPropsWithoutRef, forwardRef, useState } from 'react';
import assert from 'assert';

import {
  Box,
  Button,
  Center,
  Divider,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { ContextModalProps, closeAllModals, openConfirmModal } from '@mantine/modals';

import { IconCalendarEvent, IconTrash } from '@tabler/icons-react';

import RichTextEditor from '../components/rte/RichTextEditor';

import config from '@/config';
import { BoardWrapper, DomainWrapper } from '@/lib/hooks';
import { TaskCollection } from '@/lib/types';

import moment from 'moment';


////////////////////////////////////////////////////////////
export type CreateTaskCollectionProps = {
  board: BoardWrapper;
  domain: DomainWrapper;
  mode: 'cycle' | 'collection';

  onCreate: (collection_id: string) => any;
}

////////////////////////////////////////////////////////////
export function CreateTaskCollection({ context, id, innerProps: props }: ContextModalProps<CreateTaskCollectionProps>) {
  const form = useForm({
    initialValues: {
      name: props.mode === 'cycle' ? `Cycle - ${moment(new Date()).format('YYYY[w]W')}` : '',
      description: '',
      start_date: null as Date | null,
      end_date: null as Date | null,
    },
  });

  const [loading, setLoading] = useState<boolean>(false);


  return (
    <form onSubmit={form.onSubmit(async (values) => {
      // Check if dates are filled
      if (props.mode === 'cycle') {
        if (!form.values.start_date){
          form.setFieldError('start_date', 'Please add a start date');
          return;
        }
        if (!form.values.end_date){
          form.setFieldError('end_date', 'Please add an end date');
          return;
        }
      }

      setLoading(true);

      // Add collection
      const newBoard = await props.board._mutators.addCollection({
        ...values,
        start_date: values.start_date?.toISOString(),
        end_date: values.end_date?.toISOString(),
      });

      setLoading(false);
      context.closeModal(id);

      // Callback
      if (newBoard) {
        const newCollection = newBoard.collections.at(-1);
        assert(newCollection);
        props.onCreate(newCollection.id);
      }
    })}>
      <Stack>
        {props.mode === 'cycle' && (
          <Text size='xs' color='dimmed'>
            A cycle is a period of time during which a team focuses on completing a set of tasks.
            Tasks are typically selected from the backlog, based on the immediate goals and priorities.
          </Text>
        )}
        {props.mode === 'collection' && (
          <Text size='xs' color='dimmed'>
            A collection is a general set of tasks. It is useful for organizing tasks that don't belong
            in a cycle into categories.
          </Text>
        )}

        <TextInput
          label='Name'
          placeholder='None'
          required
          {...form.getInputProps('name')}
        />

        <Box>
          <Text size='sm' weight={600}>Description</Text>
          {props.mode === 'cycle' && (
            <Text size='xs' color='dimmed' mb={5}>
              Use this area to write a description and goals for this cycle
            </Text>
          )}
          <RichTextEditor
            domain={props.domain}
            {...form.getInputProps('description')}
          />
        </Box>

        {props.mode === 'cycle' && (
          <>
            <DatePickerInput
              label='Start Date'
              placeholder='None'
              icon={<IconCalendarEvent size={19} />}
              popoverProps={{ withinPortal: true }}
              clearable
              required
              sx={{ maxWidth: config.app.ui.med_input_width }}
              {...form.getInputProps('start_date')}
              onChange={(date) => {
                // Change default name if it wasn't changed
                if (!form.isDirty('name'))
                  form.setFieldValue('name', `Cycle - ${moment(date).format('YYYY[w]W')}`);

                form.setFieldValue('start_date', date);
              }}
            />

            <Box>
              <DatePickerInput
                label='End Date'
                description={(() => {
                  if (!form.values.end_date || !form.values.start_date) return undefined;
                  const t = form.values.start_date;
                  const diff = moment(form.values.end_date).diff([t.getFullYear(), t.getMonth(), t.getDate()], 'days');
                  return `This cycle lasts ${diff} day${diff === 1 ? '' : 's'}`;
                })()}
                placeholder='None'
                icon={<IconCalendarEvent size={19} />}
                popoverProps={{ withinPortal: true }}
                clearable
                required
                minDate={form.values.start_date || undefined}
                renderDay={(date) => {
                  return (
                    <Center w='100%' h='100%' sx={(theme) => ({
                      border: date.getTime() === form.values.start_date?.getTime() ? `1px solid ${theme.colors.indigo[5]}` : 'none',
                      borderRadius: '0.25rem',
                    })}>
                      {date.getDate()}
                    </Center>
                  );
                }}
                sx={{ maxWidth: config.app.ui.med_input_width }}
                {...form.getInputProps('end_date')}
              />
              {form.values.start_date && !form.values.end_date && (
                <Group mt={6} spacing={6}>
                  <Button variant='outline'
                    onClick={() => form.setFieldValue('end_date', moment(form.values.start_date).add(1, 'week').toDate())}
                  >
                    1 week
                  </Button>
                  <Button variant='outline'
                    onClick={() => form.setFieldValue('end_date', moment(form.values.start_date).add(2, 'weeks').toDate())}
                  >
                    2 weeks
                  </Button>
                  <Button variant='outline'
                    onClick={() => form.setFieldValue('end_date', moment(form.values.start_date).add(1, 'months').toDate())}
                  >
                    1 month
                  </Button>
                </Group>
              )}
            </Box>
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


////////////////////////////////////////////////////////////
export type EditTaskCollectionProps = {
  board: BoardWrapper;
  domain: DomainWrapper;
  collection: TaskCollection;

  onDelete: () => any;
}

////////////////////////////////////////////////////////////
export function EditTaskCollection({ context, id, innerProps: props }: ContextModalProps<EditTaskCollectionProps>) {
  const form = useForm({
    initialValues: {
      name: props.collection.name,
      description: props.collection.description || '',
      start_date: props.collection.start_date ? new Date(props.collection.start_date) : null,
      end_date: props.collection.end_date ? new Date(props.collection.end_date) : null,
    },
  });

  const [loading, setLoading] = useState<boolean>(false);


  // Cycle type if either of dates are filled
  const isCycle = props.collection.start_date || props.collection.end_date;
  
  return (
    <form onSubmit={form.onSubmit(async (values) => {
      // Check if dates are filled
      if (isCycle) {
        if (!form.values.start_date){
          form.setFieldError('start_date', 'Please add a start date');
          return;
        }
        if (!form.values.end_date){
          form.setFieldError('end_date', 'Please add an end date');
          return;
        }
      }

      setLoading(true);

      // Add collection
      await props.board._mutators.updateCollection(props.collection.id, {
        ...values,
        start_date: values.start_date?.toISOString(),
        end_date: values.end_date?.toISOString(),
      });

      setLoading(false);
      context.closeModal(id);
    })}>
      <Stack>
        <TextInput
          label='Name'
          placeholder='None'
          required
          withAsterisk={false}
          {...form.getInputProps('name')}
        />

        <Box>
          <Text size='sm' weight={600}>Description</Text>
          <RichTextEditor
            domain={props.domain}
            {...form.getInputProps('description')}
          />
        </Box>

        {isCycle && (
          <>
            <DatePickerInput
              label='Start Date'
              placeholder='None'
              icon={<IconCalendarEvent size={19} />}
              popoverProps={{ withinPortal: true }}
              clearable
              sx={{ maxWidth: config.app.ui.med_input_width }}
              {...form.getInputProps('start_date')}
              onChange={(date) => {
                // Change default name if it wasn't changed
                if (!form.isDirty('name'))
                  form.setFieldValue('name', `Cycle - ${moment(date).format('YYYY[w]W')}`);

                form.setFieldValue('start_date', date);
              }}
            />

            <Box>
              <DatePickerInput
                label='End Date'
                description={(() => {
                  if (!form.values.end_date || !form.values.start_date) return undefined;
                  const t = form.values.start_date;
                  const diff = moment(form.values.end_date).diff([t.getFullYear(), t.getMonth(), t.getDate()], 'days');
                  return `This cycle lasts ${diff} day${diff === 1 ? '' : 's'}`;
                })()}
                placeholder='None'
                icon={<IconCalendarEvent size={19} />}
                popoverProps={{ withinPortal: true }}
                clearable
                minDate={form.values.start_date || undefined}
                renderDay={(date) => {
                  return (
                    <Center w='100%' h='100%' sx={(theme) => ({
                      border: date.getTime() === form.values.start_date?.getTime() ? `1px solid ${theme.colors.indigo[5]}` : 'none',
                      borderRadius: '0.25rem',
                    })}>
                      {date.getDate()}
                    </Center>
                  );
                }}
                sx={{ maxWidth: config.app.ui.med_input_width }}
                {...form.getInputProps('end_date')}
              />
              {form.values.start_date && !form.values.end_date && (
                <Group mt={6} spacing={6}>
                  <Button variant='outline'
                    onClick={() => form.setFieldValue('end_date', moment(form.values.start_date).add(1, 'week').toDate())}
                  >
                    1 week
                  </Button>
                  <Button variant='outline'
                    onClick={() => form.setFieldValue('end_date', moment(form.values.start_date).add(2, 'weeks').toDate())}
                  >
                    2 weeks
                  </Button>
                  <Button variant='outline'
                    onClick={() => form.setFieldValue('end_date', moment(form.values.start_date).add(1, 'months').toDate())}
                  >
                    1 month
                  </Button>
                </Group>
              )}
            </Box>
          </>
        )}

        <Group spacing='xs' mt={16}>
          <Button
            color='red'
            leftIcon={<IconTrash size={18} />}
            onClick={() => {
              openConfirmModal({
                title: `Delete ${isCycle ? 'Cycle' : 'Collection'}`,
                labels: { cancel: 'Cancel', confirm: 'Delete' },
                children: (
                  <Text>
                    Are you sure you want to delete <b>{props.collection.name}</b>?<br />
                    <Text span size='sm' color='dimmed'>All tasks in this {isCycle ? 'cycle' : 'collection'} will be moved to <b>Backlog</b>.</Text>
                  </Text>
                ),
                groupProps: {
                  spacing: 'xs',
                  sx: { marginTop: '0.5rem' },
                },
                confirmProps: {
                  color: 'red',
                },
                onConfirm: () => {
                  props.board._mutators.removeCollection(props.collection.id);
                  closeAllModals();

                  // Callback
                  props.onDelete();
                }
              })
            }}
          >
            Delete
          </Button>
          <div style={{ flexGrow: 1 }} />

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
            Save
          </Button>
        </Group>
      </Stack>
    </form>
  );
}