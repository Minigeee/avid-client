import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Flex,
  Group,
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

import { CalendarStyle, OnDeleteEvent, OnEditEvent, OnNewEvent } from './types';
import { CalendarContext } from './hooks';
import DayView from './DayView';
import MonthView from './MonthView';
import WeekView from './WeekView';

import { CalendarEvent, DeepPartial } from '@/lib/types';
import { DomainWrapper } from '@/lib/hooks';

import moment, { Moment } from 'moment';
import { merge, range } from 'lodash';
import { CalendarEventContextMenu } from './EventMenu';

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

  // Callback refs
  const onNewEventRef = useRef(props.onNewEvent);
  const onEditEventRef = useRef(props.onEditEvent);
  const onDeleteEventRef = useRef(props.onDeleteEvent);

  // Time the calendar should display
  const [time, setTimeImpl] = useState<Moment>(moment());
  // Calendar view
  const [view, setView] = useState<CalendarView>('week');
  // The id of the currently opened popup
  const [popupId, setPopupId] = useState<string | null>(null);

  // Update refs on function change
  useEffect(() => {
    onNewEventRef.current = props.onNewEvent;
    onEditEventRef.current = props.onEditEvent;
    onDeleteEventRef.current = props.onDeleteEvent;
  }, [props.onNewEvent, props.onEditEvent, props.onDeleteEvent]);

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
          console.log('on submit', event);
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
      <Flex direction="column" w="100%" h="100%">
        <SimpleGrid pb={12} cols={3}>
          <Group spacing={2}>
            {props.editable && (
              <>
                <Button
                  variant="gradient"
                  size="xs"
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
                        await props.onNewEvent?.(event);
                      },
                    });
                  }}
                >
                  Create
                </Button>
                <Divider orientation="vertical" ml={10} mr={10} />
              </>
            )}

            <Button
              size="xs"
              variant="default"
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
                tooltip="Refresh"
                tooltipProps={{ position: 'right' }}
                hoverBg={(theme) => theme.colors.dark[6]}
                ml={2}
                onClick={props.onRefresh}
              >
                <IconRefresh size={20} />
              </ActionButton>
            )}
          </Group>

          <Title order={3} align="center" sx={{ alignSelf: 'center' }}>
            {title}
          </Title>

          <Button.Group sx={{ justifySelf: 'flex-end' }}>
            <Button
              size="xs"
              variant="default"
              sx={(theme) => ({
                backgroundColor:
                  view === 'month' ? theme.colors.dark[5] : undefined,
              })}
              onClick={() => setView('month')}
            >
              Month
            </Button>
            <Button
              size="xs"
              variant="default"
              sx={(theme) => ({
                backgroundColor:
                  view === 'week' ? theme.colors.dark[5] : undefined,
              })}
              onClick={() => setView('week')}
            >
              Week
            </Button>
            <Button
              size="xs"
              variant="default"
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
              onEventChange={props.onEditEvent}
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
              onEventChange={props.onEditEvent}
            />
          )}

          {view === 'day' && (
            <DayView
              time={time}
              events={props.events}
              editable={props.editable !== false}
              style={styles}
              onNewEventRequest={onNewEventRequest}
              onEventChange={props.onEditEvent}
            />
          )}
        </CalendarEventContextMenu>
      </Flex>
    </CalendarContext.Provider>
  );
}

export type { OnEditEvent, OnNewEvent, OnDeleteEvent } from './types';
