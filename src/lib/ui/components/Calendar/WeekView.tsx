import { useEffect, useMemo, useRef } from 'react';

import {
  Box,
  Flex,
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
export type WeekViewProps = {
  /** A date within the week that should be displayed */
  time: Moment;
  /** List of events from the calendar */
  events: CalendarEvent[];

  /** Calendar styles */
  style: CalendarStyle;
  /** For jumping to day view */
  setDay: (day: Moment) => void;
};

////////////////////////////////////////////////////////////
export default function WeekView(props: WeekViewProps) {
  // Scroll area
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // The start of the week
  const start = useMemo(() => moment(props.time).startOf('week'), [props.time]);

  // Prefilter events that are in this week
  const events = useMemo(() => {
    // End of week
    const end = moment(start).add(1, 'week');

    return props.events.filter((e) => {
      const estart = moment(e.start);
      return estart.isBefore(end) && (e.end && moment(e.end).isAfter(start) || e.all_day && estart.isAfter(start));
    });
  }, [start, props.events]);

  // Events that should be displayed in all day section
  const { filtered: allDayEvents, maxNumColumns: numAllDayRows } = useMemo(() => {
    // Filter events
    const filtered = events
      .filter((e) => e.all_day || e.end && moment(e.end).subtract(1, 'day').isAfter(e.start))
      .map((e) => ({
        ...e,
        start: moment(e.start).startOf('day'),
        end: moment(e.end || e.start).endOf('day'),
        left: 0,
        width: 1,
        top: 0,
        has_prev: false,
        has_next: false,
      }))
      .sort((a, b) => {
        return (a.start.unix() - b.start.unix()) || (a.end.unix() - b.end.unix()) || (b.title.length - a.title.length);
      });

    // Grid of event columns
    let columns: (typeof filtered)[] = [];
    // Tracks the last event ending
    let lastEventEnding: Moment | null = null;
    // Max number of columns
    let maxNumColumns = 0;
    
    // Checks if date ranges collide
    function collides(a: { start: Moment; end: Moment }, b: { start: Moment; end: Moment }) {
      return a.start.isBefore(b.end) && a.end.isAfter(b.start);
    }

    // Packs events
    function packEvents(columns: (typeof filtered)[]) {
      for (let i = 0; i < columns.length; ++i) {
        const col = columns[i];

        for (const e of col)
          e.top = i;
      }
    }

    // Place the events
    for (const e of filtered) {
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
    for (const e of filtered) {
      e.has_prev = e.start.week() !== props.time.week();
      e.has_next = e.end.week() !== props.time.week();
      const start = e.has_prev ? 0 : e.start.day();
      const end = e.has_next ? 7 : e.end.day() + 1;

      e.left = start;
      e.width = end - start;
    }

    return { filtered, maxNumColumns };
  }, [events]);

  // Scroll to current time on mount
  useEffect(() => {
    if (!scrollAreaRef.current) return;
    scrollAreaRef.current.scrollTo({
      top: scrollAreaRef.current.scrollHeight / 24 * moment().hours() - scrollAreaRef.current.clientHeight / 2,
    });
  }, [scrollAreaRef]);


  return (
    <Flex direction='column' h={0} w='100%' mt={8} sx={{ flexGrow: 1 }}>
      {/* Day labels */}
      <Flex ml={props.style.timeGutter}>
        {range(7).map((i) => {
          const date = moment(start).add(i, 'day');

          return (
            <UnstyledButton
              sx={(theme) => ({
                flex: '1 1 0px',
                paddingTop: '0.1rem',
                paddingBottom: '0.25rem',
                borderRadius: theme.radius.sm,
                transition: 'background-color 0.18s',

                '&:hover': {
                  backgroundColor: theme.colors.dark[6],
                },
              })}
              onClick={() => props.setDay(moment(start).add(i, 'day'))}
            >
              <Stack spacing={0} align='center'>
                <Text color='dimmed'>{date.format('ddd')}</Text>
                <Title order={3}>{date.format('D')}</Title>
              </Stack>
            </UnstyledButton>
          );
        })}
      </Flex>

      {/* All day events */}
      <Flex sx={{ position: 'relative' }}>
        <Box sx={{
            width: props.style.timeGutter,
            borderBottom: `1px solid ${props.style.colors.cellBorder}`,
            minHeight: '1.25rem',
          }} />

        {range(7).map((i) => (
          <Box sx={{
            flex: '1 1 0px',
            borderLeft: `1px solid ${props.style.colors.cellBorder}`,
            borderBottom: `1px solid ${props.style.colors.cellBorder}`,
            minHeight: '1.25rem',
            height: `calc(${numAllDayRows * 1.75}rem + 1px)`
          }} />
        ))}

        {allDayEvents.map((e) => (
          <Box
            sx={(theme) => ({
              position: 'absolute',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              width: `calc((100% - ${props.style.timeGutter}) * ${e.width - (e.has_next ? 0 : 0.05)} / 7)`,
              height: '1.625rem',
              top: `${e.top * 1.75}rem`,
              left: `calc(${e.left} / 7 * (100% - ${props.style.timeGutter}) + ${props.style.timeGutter} + 1px)`,

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

      <ScrollArea viewportRef={scrollAreaRef} sx={{ flexGrow: 1 }}>
        <Flex w='100%'>
          <Stack align='flex-end' sx={(theme) => ({
            width: props.style.timeGutter,
            paddingTop: `calc(${props.style.slotHeight} - ${theme.fontSizes.xs} / 2 - 0.0625rem)`,
            paddingRight: '0.375rem',
            gap: `calc(${props.style.slotHeight} - ${theme.fontSizes.xs})`,
          })}>
            {range(23).map((i) => (
              <Text size='xs' weight={600} color='dimmed' sx={{ lineHeight: 1 }}>
                {moment(start).add(i + 1, 'hour').format('LT')}
              </Text>
            ))}
          </Stack>

          {range(7).map((i) => (
            <TimeColumn
              day={moment(start).add(i, 'day')}
              events={events}
              style={props.style}
            />
          ))}
        </Flex>
      </ScrollArea>
    </Flex>
  );
}
