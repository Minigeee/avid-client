import { useEffect, useMemo, useRef } from 'react';

import {
  ActionIcon,
  Box,
  ColorSwatch,
  Flex,
  Group,
  ScrollArea,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useElementSize } from '@mantine/hooks';

import TimeColumn from './TimeColumn';

import { CalendarEvent } from '@/lib/types';

import { CalendarStyle } from './types';
import moment, { Moment } from 'moment';
import { range } from 'lodash';


////////////////////////////////////////////////////////////
type WeekRowProps = {
  /** A date within the month that should be displayed */
  time: Moment;
  /** The date range of the month */
  monthRange: [Moment, Moment];
  /** List of events from the calendar */
  events: CalendarEvent[];

  /** Calendar styles */
  style: CalendarStyle;
  /** For jumping to day view */
  setDay: (day: Moment) => void;
  /** Indicates if this is the last row in the month */
  lastRow: boolean;
};

////////////////////////////////////////////////////////////
function WeekRow(props: WeekRowProps) {
  // Prefilter events that are in this week
  const events = useMemo(() => {
    // End of week
    const end = moment(props.time).add(1, 'week');

    return props.events.filter((e) => {
      const estart = moment(e.start);
      return estart.isBefore(end) && (e.end && moment(e.end).isAfter(props.time) || e.all_day && estart.isAfter(props.time));
    });
  }, [props.time, props.events]);

  // Split events into their categories
  const { allDayEvents, dayEvents, dayOffsets } = useMemo(() => {
    // List of all day events
    const allDayEvents: (Omit<CalendarEvent, 'start' | 'end'> & {
      start: Moment;
      end: Moment;
      left: number;
      top: number;
      width: number;
      has_prev: boolean;
      has_next: boolean;
    })[] = [];
    // Day events
    const dayEvents: (Omit<CalendarEvent, 'start' | 'end'> & { start: Moment; end: Moment; })[][] = [[], [], [], [], [], [], []];

    // Split events up
    for (const e of events) {
      if (e.all_day || e.end && moment(e.end).subtract(1, 'day').isAfter(e.start)) {
        allDayEvents.push({
          ...e,
          start: moment(e.start).startOf('day'),
          end: moment(e.end || e.start).endOf('day'),
          left: 0,
          width: 1,
          top: 0,
          has_prev: false,
          has_next: false,
        });
      }
      else {
        const start = moment(e.start);
        dayEvents[start.day()].push({
          ...e,
          start,
          end: moment(e.end),
        });
      }
    }

    // Sort events
    allDayEvents.sort((a, b) => {
      return (a.start.unix() - b.start.unix()) || (a.end.unix() - b.end.unix()) || (b.title.length - a.title.length);
    });

    for (const evs of dayEvents) {
      evs.sort((a, b) => {
        return (a.start.unix() - b.start.unix()) || (a.end.unix() - b.end.unix()) || (b.title.length - a.title.length);
      });
    }


    // Grid of event columns
    let columns: (typeof allDayEvents)[] = [];
    // Tracks the last event ending
    let lastEventEnding: Moment | null = null;
    // Max number of columns
    let maxNumColumns = 0;

    // Checks if date ranges collide
    function collides(a: { start: Moment; end: Moment }, b: { start: Moment; end: Moment }) {
      return a.start.isBefore(b.end) && a.end.isAfter(b.start);
    }

    // Packs events
    function packEvents(columns: (typeof allDayEvents)[]) {
      for (let i = 0; i < columns.length; ++i) {
        const col = columns[i];

        for (const e of col)
          e.top = i;
      }
    }

    // Place the events
    for (const e of allDayEvents) {
      // Check if group is complete
      if (lastEventEnding && e.start >= lastEventEnding) {
        packEvents(columns);
        columns = [];
        lastEventEnding = null;
      }

      let placed = false;
      for (const col of columns) {
        if (!collides(col[col.length - 1], e)) {
          col.push(e);
          placed = true;
          break;
        }
      }

      if (!placed) {
        columns.push([e]);

        if (columns.length > maxNumColumns)
          maxNumColumns = columns.length;
      }
      if (!lastEventEnding || e.end > lastEventEnding)
        lastEventEnding = e.end;
    }

    if (columns.length > 0)
      packEvents(columns);

    // Calculate other properties
    const dayOffsets = [0, 0, 0, 0, 0, 0, 0];
    for (const e of allDayEvents) {
      e.has_prev = e.start.week() !== props.time.week();
      e.has_next = e.end.week() !== props.time.week();
      const start = e.has_prev ? 0 : e.start.day();
      const end = e.has_next ? 7 : e.end.day() + 1;

      e.left = start;
      e.width = end - start;

      const top = e.top + 1;
      for (let i = start; i < end; ++i) {
        if (top > dayOffsets[i])
          dayOffsets[i] = top;
      }
    }

    return { allDayEvents, dayEvents, dayOffsets };
  }, [events]);


  return (
    <Flex w='100%' sx={{
      flex: '1 1 0px',
      position: 'relative',
    }}>
      {range(7).map((day_i) => {
        const date = moment(props.time).add(day_i, 'day');
        const inRange = date.isBetween(...props.monthRange) || date.isSame(props.monthRange[0]);

        return (
          <Box sx={(theme) => ({
            flex: '1 1 0px',
            borderLeft: `1px solid ${props.style.colors.cellBorder}`,
            borderBottom: `1px solid ${props.style.colors.cellBorder}`,
            '&:first-child': props.lastRow ? {
              borderBottomLeftRadius: theme.radius.md,
            } : undefined,
            '&:nth-child(7)': {
              borderRight: `1px solid ${props.style.colors.cellBorder}`,
              borderBottomRightRadius: props.lastRow ? theme.radius.md : undefined,
            },
          })}>
            <Group position='right' p='0.125rem'>
              <ActionIcon size='md' sx={(theme) => ({
                color: inRange ? undefined : theme.colors.dark[3],
              })} onClick={() => props.setDay(date)}>
                {date.date()}
              </ActionIcon>
            </Group>

            <Stack spacing={0} p='0 0.25rem' sx={{ position: 'relative', top: `${dayOffsets[date.day()] * 1.75}rem` }}>
              {dayEvents[date.day()].map((e) => (
                <UnstyledButton
                  sx={(theme) => ({
                    padding: '0.0625rem 0.25rem',
                    borderRadius: theme.radius.sm,
                    transition: 'background-color 0.18s',
                    opacity: inRange ? undefined : 0.8,

                    '&:hover': {
                      backgroundColor: theme.colors.dark[6],
                    },
                  })}
                >
                  <Group spacing={6} noWrap maw='100%'>
                    <ColorSwatch color={e.color || props.style.colors.event} size={14} sx={{ flexShrink: 0 }} />
                    <Text weight={600} size='sm'>{moment(e.start).format('LT')}</Text>
                    <Text size='sm' weight={400} sx={{
                      flexGrow: 1,
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>{e.title}</Text>
                  </Group>
                </UnstyledButton>
              ))}
            </Stack>
          </Box>
        );
      })}

      {allDayEvents.map((e) => (
        <Box
          sx={(theme) => ({
            position: 'absolute',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            width: `calc(100% * ${e.width - (e.has_next ? 0 : 0.05)} / 7)`,
            height: '1.625rem',
            top: `${e.top * 1.75 + 2}rem`,
            left: `calc(${e.left} / 7 * 100% + 1px)`,

            padding: '0.125rem 0.4rem',
            paddingLeft: '0.75rem',
            background: e.has_prev ? `color-mix(in srgb, ${e.color || props.style.colors.event} 20%, ${theme.colors.dark[7]})` : `linear-gradient(to right, ${e.color || props.style.colors.event} 0.25rem, color-mix(in srgb, ${e.color || props.style.colors.event} 20%, ${theme.colors.dark[7]}) 0)`,
            fontSize: theme.fontSizes.sm,
            borderTopLeftRadius: e.has_prev ? 0 : theme.radius.sm,
            borderBottomLeftRadius: e.has_prev ? 0 : theme.radius.sm,
            borderTopRightRadius: e.has_next ? 0 : theme.radius.sm,
            borderBottomRightRadius: e.has_next ? 0 : theme.radius.sm,
          })}
        >
          {e.title}
        </Box>
      ))}
    </Flex>
  );
}


////////////////////////////////////////////////////////////
export type MonthViewProps = {
  /** A date within the month that should be displayed */
  time: Moment;
  /** List of events from the calendar */
  events: CalendarEvent[];

  /** Calendar styles */
  style: CalendarStyle;
  /** For jumping to day view */
  setDay: (day: Moment) => void;
};

////////////////////////////////////////////////////////////
export default function MonthView(props: MonthViewProps) {
  // The start/ of the month
  const monthRange = useMemo(() => {
    const start = moment(props.time).startOf('month');
    return [start, moment(start).add(1, 'month')] as [Moment, Moment];
  }, [props.time]);
  // Start of the view (start of the week that contains the start of month)
  const start = useMemo(() => moment(monthRange[0]).startOf('week'), [monthRange[0]]);

  // Number of weeks that need to be displayed
  const numWeeks = useMemo(() => Math.ceil(monthRange[1].diff(start, 'days') / 7), [monthRange[1], start]);

  // Prefilter events that are in this month
  const events = useMemo(() => {
    // End of week
    const end = moment(start).add(5, 'week');

    return props.events.filter((e) => {
      const estart = moment(e.start);
      return estart.isBefore(end) && (e.end && moment(e.end).isAfter(start) || e.all_day && estart.isAfter(start));
    });
  }, [start, props.events]);


  return (
    <Flex direction='column' h={0} w='100%' sx={{ flexGrow: 1 }}>
      <Flex w='100%'>
        {range(7).map((day_i) => (
          <Text
            align='center'
            weight={600}
            sx={(theme) => ({
              flex: '1 1 0px',
              backgroundColor: theme.colors.dark[8],
              paddingTop: '0.125rem',
              paddingBottom: '0.125rem',
              borderLeft: `1px solid ${props.style.colors.cellBorder}`,
              borderTop: `1px solid ${props.style.colors.cellBorder}`,
              '&:first-child': {
                borderTopLeftRadius: theme.radius.md,
              },
              '&:last-child': {
                borderRight: `1px solid ${props.style.colors.cellBorder}`,
                borderTopRightRadius: theme.radius.md,
              },
            })}
          >
            {moment(start).add(day_i, 'day').format('ddd')}
          </Text>
        ))}
      </Flex>

      {range(numWeeks).map((week_i) => (
        <WeekRow
          time={moment(start).add(week_i, 'week')}
          monthRange={monthRange}
          events={events}
          style={props.style}
          setDay={props.setDay}
          lastRow={week_i === 4}
        />
      ))}
    </Flex>
  );
}
