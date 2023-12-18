import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import assert from 'assert';

import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Flex,
  Group,
  Radio,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Title,
  UnstyledButton,
  useMantineTheme,
} from '@mantine/core';
import {
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconRefresh,
} from '@tabler/icons-react';

import { openCreateCalendarEvent } from '@/lib/ui/modals';
import ActionButton from '@/lib/ui/components/ActionButton';

import {
  CalendarStyle,
  MomentCalendarEvent,
  OnDeleteEvent,
  OnEditEvent,
  OnEditEventInternal,
  OnNewEvent,
} from './types';
import { CalendarContext } from './hooks';
import DayView from './DayView';
import MonthView from './MonthView';
import WeekView from './WeekView';
import { CalendarEventContextMenu } from './EventMenu';
import { useConfirmModal } from '@/lib/ui/modals/ConfirmModal';

import { CalendarEvent, DeepPartial } from '@/lib/types';
import { DomainWrapper } from '@/lib/hooks';

import moment, { Moment } from 'moment';
import { merge, range } from 'lodash';

////////////////////////////////////////////////////////////
export type CalendarView = 'month' | 'week' | 'day' | 'resource';

////////////////////////////////////////////////////////////
export type CalendarProps = {
  /** List of events */
  events: CalendarEvent[];
  /** Domain the calendar is part of, used for context */
  domain?: DomainWrapper;

  /** Determines if a refresh button should be shown (default false) */
  withRefresh?: boolean;
  /** Determines if user can manage calendar events (default true) */
  editable?: boolean;

  /** Called when a new event is created */
  onNewEvent?: OnNewEvent;
  /** Called when an event is edited */
  onEditEvent?: OnEditEvent;
  /** Called when an event is edited */
  onDeleteEvent?: OnDeleteEvent;
  /** Called when viewing date changes */
  onDateChange?: (date: Moment) => void;
  /** Called when the refresh button is clicked */
  onRefresh?: () => void;

  /** Optional calendar style */
  styles?: DeepPartial<CalendarStyle>;
};

////////////////////////////////////////////////////////////
export default function Calendar(props: CalendarProps) {
  // Calendar style
  const theme = useMantineTheme();
  const styles = useMemo(
    () =>
      merge({}, props.styles, {
        colors: {
          event: theme.colors.gray[6],
          cellBorder: theme.colors.dark[5],
          timeIndicator: theme.colors.indigo[4],
        },
        timeGutter: 60,
        monthHeaderHeight: 32,
        slotHeight: '4rem',

        resizeMarginSize: 6,
      } as CalendarStyle),
    [],
  );

  const { open: openConfirmModal } = useConfirmModal();
  const confirmChoiceRef = useRef<string>('');

  // Function that gets called when event is editted
  const onEditEventInternal = useCallback(
    ((newEvent, origEvent) => {
      if (!props.onEditEvent) return;

      // If user confirm is true, the user will be asked for confirmation and update shouldn't happen yet
      let userConfirm = false;

      // If repeated event and changed days
      if (origEvent.repeat && (newEvent.start || newEvent.end)) {
        // The time of the repeat event was changed, need to ask user to change only this
        // event, or if all events need to be changed
        userConfirm = true;

        // Reset user choice
        confirmChoiceRef.current = 'this';

        // Ask user
        openConfirmModal({
          title: 'Edit Repeating Event',
          content: (
            <Radio.Group
              defaultValue='this'
              onChange={(value) => (confirmChoiceRef.current = value)}
            >
              <Stack spacing='sm' mt={8}>
                <Radio value='this' label='Only this event' />
                <Radio value='all' label='All events' />
              </Stack>
            </Radio.Group>
          ),
          confirmLabel: 'Save',
          confirmProps: { variant: 'gradient' },
          onConfirm: () => {
            // The new start and end dates of the event
            const newStart = newEvent.start || origEvent.start;
            const newEnd =
              newEvent.end || origEvent.end || moment(newStart).add(1, 'hour');

            // Get base event (only one in events list)
            const baseEvent =
              props.events.find((x) => x.id === origEvent.id) || origEvent;

            // Handle case where all events requested for change
            if (confirmChoiceRef.current === 'all') {
              // Handle case where event switches days (and not in week mode: week mode only switches hours, then modifies the week day array)
              if (
                newStart.dayOfYear() !== origEvent.start.dayOfYear() &&
                origEvent.repeat?.interval_type !== 'week'
              ) {
                // Get diff in days
                const diff = newStart.dayOfYear() - origEvent.start.dayOfYear();

                // Calc new start and end times
                const start = moment(baseEvent.start)
                  .add(diff, 'days')
                  .startOf('day')
                  .add({ h: newStart.hours(), m: newStart.minutes() });
                const end = moment(start).add({
                  m: newEnd.diff(newStart, 'minutes'),
                });

                // Apply new times
                newEvent.start = start;
                newEvent.end = end;
              } else {
                // The repeat event is in week mode, or the time only changes within the original day

                // Change base event only
                const start = moment(baseEvent.start)
                  .startOf('day')
                  .add({ h: newStart.hours(), m: newStart.minutes() });
                const end = moment(start).add({
                  m: newEnd.diff(newStart, 'minutes'),
                });

                // Apply new times
                newEvent.start = start;
                newEvent.end = end;

                // Handle changing the week day array for week repeat event
                if (newStart.dayOfYear() !== origEvent.start.dayOfYear()) {
                  const remDay = origEvent.start.day();
                  newEvent.repeat = {
                    ...newEvent.repeat,
                    week_repeat_days: [
                      ...(
                        newEvent.repeat?.week_repeat_days ||
                        origEvent.repeat?.week_repeat_days ||
                        []
                      ).filter((x) => x !== remDay),
                      newStart.day(),
                    ],
                  } as CalendarEvent['repeat'];
                }
              }

              // Edit event
              props.onEditEvent?.(origEvent.id, {
                ...newEvent,
                start: newEvent.start?.toISOString(),
                end: newEvent.end?.toISOString(),
              });
            } else {
              // Normal update, but with override
              props.onEditEvent?.(
                origEvent.id,
                {
                  ...newEvent,
                  start: newEvent.start?.toISOString(),
                  end: newEvent.end?.toISOString(),
                },
                origEvent.start.toISOString(),
              );
            }
          },
        });
      }

      // Edit event
      if (!userConfirm) {
        props.onEditEvent(origEvent.id, {
          ...newEvent,
          start: newEvent.start?.toISOString(),
          end: newEvent.end?.toISOString(),
        });
      }
    }) as OnEditEventInternal,
    [props.onEditEvent],
  );

  // Internal on delete callback
  const onDeleteEventInternal = useCallback(
    (event: CalendarEvent | MomentCalendarEvent) => {
      let userConfirm = false;

      // If repeated event, ask user if delete one or all
      if (event.repeat) {
        // The time of the repeat event was changed, need to ask user to change only this
        // event, or if all events need to be changed
        userConfirm = true;

        // Reset user choice
        confirmChoiceRef.current = 'this';

        // Ask user
        openConfirmModal({
          title: 'Delete Repeating Event',
          content: (
            <Radio.Group
              defaultValue='this'
              onChange={(value) => (confirmChoiceRef.current = value)}
            >
              <Stack spacing='sm' mt={8}>
                <Radio value='this' label='Only this event' />
                <Radio value='all' label='All events' />
              </Stack>
            </Radio.Group>
          ),
          confirmLabel: 'Delete',
          onConfirm: () => {
            // Delete base event
            props.onDeleteEvent?.(
              event.id,
              confirmChoiceRef.current === 'this'
                ? typeof event.start === 'string'
                  ? event.start
                  : event.start.toISOString()
                : undefined,
            );
          },
        });
      }

      // Edit event
      if (!userConfirm) {
        openConfirmModal({
          title: 'Delete Event',
          content: (
            <Text>
              Are you sure you want to delete <b>{event.title}</b>?
            </Text>
          ),
          confirmLabel: 'Delete',
          onConfirm: () => {
            // Delete event
            props.onDeleteEvent?.(event.id);
          },
        });
      }
    },
    [props.onDeleteEvent],
  );

  // Callback refs
  const onNewEventRef = useRef(props.onNewEvent);
  const onEditEventRef = useRef(onEditEventInternal);
  const onDeleteEventRef = useRef(onDeleteEventInternal);

  // Time the calendar should display
  const [time, setTimeImpl] = useState<Moment>(moment());
  // Calendar view
  const [view, setView] = useState<CalendarView>('week');
  // The id of the currently opened popup
  const [popupId, setPopupId] = useState<string | null>(null);

  // Update refs on function change
  useEffect(() => {
    onNewEventRef.current = props.onNewEvent;
    onEditEventRef.current = onEditEventInternal;
    onDeleteEventRef.current = onDeleteEventInternal;
  }, [props.onNewEvent, onEditEventInternal, onDeleteEventInternal]);

  // Set time wrapper func
  const setTime = useCallback(
    (value: Moment) => {
      setTimeImpl(value);
      props.onDateChange?.(value);
    },
    [setTimeImpl],
  );

  // Calendar title
  const title = useMemo(() => {
    if (view === 'week') {
      const start = moment(time).startOf('week');
      const end = moment(start).add(1, 'week');

      if (start.month() !== end.month())
        return `${start.format('MMM YYYY')} - ${end.format('MMM YYYY')}`;
      else return start.format('MMMM YYYY');
    } else if (view === 'day') {
      return time.format('LL');
    } else if (view === 'month') {
      return time.format('MMMM YYYY');
    }

    return '';
  }, [time, view]);

  // Create event callback
  const onNewEventRequest = useCallback(
    (start: Moment, initial?: { duration?: number; all_day?: boolean }) => {
      // Don't open modal if can't manage events
      if (props.editable === false) return;

      openCreateCalendarEvent({
        domain: props.domain,
        event: {
          start: start.toISOString(),
          end: moment(start)
            .add(initial?.duration || 1, 'hours')
            .toISOString(),
          all_day: initial?.all_day,
        },

        onSubmit: async (event) => {
          assert(event.start);
          // @ts-ignore
          await props.onNewEvent?.(event);
        },
      });
    },
    [props.domain, props.onNewEvent],
  );

  return (
    <CalendarContext.Provider
      value={{
        domain: props.domain,
        editable: props.editable !== false,
        popupId,
        setPopupId,
        onNewEvent: onNewEventRef,
        onEditEvent: onEditEventRef,
        onDeleteEvent: onDeleteEventRef,
      }}
    >
      <Flex direction='column' w='100%' h='100%'>
        <SimpleGrid pb={12} cols={3}>
          <Group spacing={2}>
            {props.editable && (
              <>
                <Button
                  variant='gradient'
                  size='xs'
                  leftIcon={<IconPlus size={16} />}
                  onClick={() => {
                    // Nearest hour
                    const start = moment().startOf('hour');

                    openCreateCalendarEvent({
                      domain: props.domain,
                      event: {
                        start: start.toISOString(),
                        end: moment(start).add(1, 'hour').toISOString(),
                      },

                      onSubmit: async (event) => {
                        assert(event.start);
                        // @ts-ignore
                        await props.onNewEvent?.(event);
                      },
                    });
                  }}
                >
                  Create
                </Button>
                <Divider orientation='vertical' ml={10} mr={10} />
              </>
            )}

            <Button
              size='xs'
              variant='default'
              mr={6}
              onClick={() => setTime(moment())}
            >
              Today
            </Button>
            <ActionIcon
              onClick={() => {
                const newTime = moment(time);
                if (view === 'month') newTime.subtract(1, 'month');
                else if (view === 'week') newTime.subtract(1, 'week');
                else if (view === 'day') newTime.subtract(1, 'day');

                setTime(newTime);
              }}
            >
              <IconChevronLeft size={20} />
            </ActionIcon>
            <ActionIcon
              onClick={() => {
                const newTime = moment(time);
                if (view === 'month') newTime.add(1, 'month');
                else if (view === 'week') newTime.add(1, 'week');
                else if (view === 'day') newTime.add(1, 'day');

                setTime(newTime);
              }}
            >
              <IconChevronRight size={20} />
            </ActionIcon>

            {props.withRefresh && (
              <ActionButton
                tooltip='Refresh'
                tooltipProps={{ position: 'right' }}
                hoverBg={(theme) => theme.colors.dark[6]}
                ml={2}
                onClick={props.onRefresh}
              >
                <IconRefresh size={20} />
              </ActionButton>
            )}
          </Group>

          <Title order={3} align='center' sx={{ alignSelf: 'center' }}>
            {title}
          </Title>

          <Button.Group sx={{ justifySelf: 'flex-end' }}>
            <Button
              size='xs'
              variant='default'
              sx={(theme) => ({
                backgroundColor:
                  view === 'month' ? theme.colors.dark[5] : undefined,
              })}
              onClick={() => setView('month')}
            >
              Month
            </Button>
            <Button
              size='xs'
              variant='default'
              sx={(theme) => ({
                backgroundColor:
                  view === 'week' ? theme.colors.dark[5] : undefined,
              })}
              onClick={() => setView('week')}
            >
              Week
            </Button>
            <Button
              size='xs'
              variant='default'
              sx={(theme) => ({
                backgroundColor:
                  view === 'day' ? theme.colors.dark[5] : undefined,
              })}
              onClick={() => setView('day')}
            >
              Day
            </Button>
          </Button.Group>
        </SimpleGrid>

        <CalendarEventContextMenu>
          {view === 'month' && (
            <MonthView
              time={time}
              events={props.events}
              editable={props.editable !== false}
              style={styles}
              setDay={(day) => {
                setTime(day);
                setView('day');
              }}
              onNewEventRequest={onNewEventRequest}
            />
          )}

          {view === 'week' && (
            <WeekView
              time={time}
              events={props.events}
              editable={props.editable !== false}
              style={styles}
              setDay={(day) => {
                setTime(day);
                setView('day');
              }}
              onNewEventRequest={onNewEventRequest}
            />
          )}

          {view === 'day' && (
            <DayView
              time={time}
              events={props.events}
              editable={props.editable !== false}
              style={styles}
              onNewEventRequest={onNewEventRequest}
            />
          )}
        </CalendarEventContextMenu>
      </Flex>
    </CalendarContext.Provider>
  );
}

export type { OnEditEvent, OnNewEvent, OnDeleteEvent } from './types';
