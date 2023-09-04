import { useMemo, useState } from 'react';

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

import DayView from './DayView';
import MonthView from './MonthView';
import WeekView from './WeekView';

import { CalendarEvent, DeepPartial } from '@/lib/types';

import { CalendarStyle } from './types';
import moment, { Moment } from 'moment';
import { merge, range } from 'lodash';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';


////////////////////////////////////////////////////////////
export type CalendarView = 'month' | 'week' | 'day' | 'resource';

////////////////////////////////////////////////////////////
export type CalendarProps = {
  /** List of events */
  events: CalendarEvent[];

  /** Optional calendar style */
  styles?: DeepPartial<CalendarStyle>;
};

////////////////////////////////////////////////////////////
export default function Calendar(props: CalendarProps) {
  // Calendar style
  const theme = useMantineTheme();
  const styles = useMemo(() => merge({}, props.styles, {
    colors: {
      event: theme.colors.gray[6],
      cellBorder: theme.colors.dark[5],
      timeIndicator: theme.colors.indigo[4],
    },
    timeGutter: 60,
    monthHeaderHeight: 32,
    slotHeight: '4rem',
  } as CalendarStyle), []);

  // Time the calendar should display
  const [time, setTime] = useState<Moment>(moment());
  // Calendar view
  const [view, setView] = useState<CalendarView>('week');

  // Calendar title
  const title = useMemo(() => {
    if (view === 'week') {
      const start = moment(time).startOf('week');
      const end = moment(start).add(1, 'week');

      if (start.month() !== end.month())
        return `${start.format('MMM YYYY')} - ${end.format('MMM YYYY')}`;
      else
        return start.format('MMMM YYYY');
    }
    else if (view === 'day') {
      return time.format('LL');
    }
    else if (view === 'month') {
      return time.format('MMMM YYYY');
    }

    return '';
  }, [time, view]);


  return (
    <Flex direction='column' w='100%' h='100%'>
      <SimpleGrid pb={12} cols={3}>
        <Group spacing={2}>
          <Button
            size='xs'
            variant='default'
            mr={6}
            onClick={() => setTime(moment())}
          >
            Today
          </Button>
          <ActionIcon onClick={() => {
            const newTime = moment(time);
            if (view === 'month')
              newTime.subtract(1, 'month');
            else if (view === 'week')
              newTime.subtract(1, 'week');
            else if (view === 'day')
              newTime.subtract(1, 'day');

            setTime(newTime);
          }}>
            <IconChevronLeft size={20} />
          </ActionIcon>
          <ActionIcon onClick={() => {
            const newTime = moment(time);
            if (view === 'month')
              newTime.add(1, 'month');
            else if (view === 'week')
              newTime.add(1, 'week');
            else if (view === 'day')
              newTime.add(1, 'day');

            setTime(newTime);
          }}>
            <IconChevronRight size={20} />
          </ActionIcon>
        </Group>

        <Title order={3} align='center' sx={{ alignSelf: 'center' }}>
          {title}
        </Title>

        <Button.Group sx={{ justifySelf: 'flex-end' }}>
          <Button
            size='xs'
            variant='default'
            sx={(theme) => ({
              backgroundColor: view === 'month' ? theme.colors.dark[5] : undefined,
            })}
            onClick={() => setView('month')}
          >
            Month
          </Button>
          <Button
            size='xs'
            variant='default'
            sx={(theme) => ({
              backgroundColor: view === 'week' ? theme.colors.dark[5] : undefined,
            })}
            onClick={() => setView('week')}
          >
            Week
          </Button>
          <Button
            size='xs'
            variant='default'
            sx={(theme) => ({
              backgroundColor: view === 'day' ? theme.colors.dark[5] : undefined,
            })}
            onClick={() => setView('day')}
          >
            Day
          </Button>
        </Button.Group>
      </SimpleGrid>

      {view === 'month' && (
        <MonthView
          time={time}
          events={props.events}
          style={styles}

          setDay={(day) => {
            setTime(day);
            setView('day');
          }}
        />
      )}

      {view === 'week' && (
        <WeekView
          time={time}
          events={props.events}
          style={styles}

          setDay={(day) => {
            setTime(day);
            setView('day');
          }}
        />
      )}

      {view === 'day' && (
        <DayView
          time={time}
          events={props.events}
          style={styles}
        />
      )}
    </Flex>
  );
}
