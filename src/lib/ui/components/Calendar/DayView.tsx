import { useCallback, useEffect, useMemo, useRef } from 'react';

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

import EventButton from './EventButton';
import TimeColumn from './TimeColumn';

import { CalendarEvent } from '@/lib/types';

import { useDragCreate, useDraggableGridEvents } from './hooks';
import { CalendarStyle, MomentCalendarEvent } from './types';

import moment, { Moment } from 'moment';
import { range } from 'lodash';
import assert from 'assert';


////////////////////////////////////////////////////////////
export type DayViewProps = {
  /** A date within the day that should be displayed */
  time: Moment;
  /** List of events from the calendar */
  events: CalendarEvent[];

  /** Are events editable */
  editable: boolean;
  /** Calendar styles */
  style: CalendarStyle;
  
  /** Called when a new event should be created */
  onNewEventRequest?: (start: Moment, initial?: { duration?: number, all_day?: boolean }) => void;
  /** Called when an event changes */
  onEventChange?: (id: string, event: Partial<CalendarEvent>) => void;
};

////////////////////////////////////////////////////////////
export default function DayView(props: DayViewProps) {
  // Scroll area
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // The start of the day
  const start = useMemo(() => moment(props.time).startOf('day'), [props.time]);
  

  // Called when event is dropped
  const onEventDrop = useCallback((e: MomentCalendarEvent, gridPos: { x: number; y: number }) => {
    // Calculate new times
    const duration = e.end ? moment(e.end).diff(e.start) : moment({ h: 1 }).unix();
    const start = moment(props.time).startOf('day').add(gridPos.y, 'hours');
    const end = moment(start).add(duration);

    // User callback
    props.onEventChange?.(e.id, {
      start: start.toISOString(),
      end: end.toISOString(),
    });
  }, [props.time, props.onEventChange]);

  // Drag drop for day events
  const dragDropDay = useDraggableGridEvents({
    scrollAreaRef,
    timeGutter: props.style.timeGutter,
    rows: 24 * 4,
    cols: 1,
    subdivisions: 4,
    onDrop: onEventDrop,
  });

  // Drag create events
  const dragCreate = useDragCreate({
    containerRef: scrollAreaRef,
    timeGutter: props.style.timeGutter,
    rows: 24 * 4,
    cols: 1,
    subdivisions: 4,
    onCreate: (startIdx, duration) => {
      props.onNewEventRequest?.(
        moment(start).add(startIdx.y, 'hours'),
        { duration }
      );
    },
  });

  // Update dragged event times
  const draggedEventTimes = useMemo(() => {
    if (dragCreate.event) return dragCreate.event;

    const { event, gridPos } = dragDropDay;
    if (!event || !gridPos)
      return { start: moment(), end: moment() };

    const duration = event.end ? event.end.diff(event.start) : moment({ h: 1 }).unix();
    const start = moment({ h: gridPos.y / 4, m: 60 * (gridPos.y % 4) / 4 });
    const end = moment(start).add(duration);

    return { start, end };
  }, [dragDropDay.gridPos?.x, dragDropDay.gridPos?.y, dragCreate.event?.start, dragCreate.event?.end]);

  const newEventObj = dragCreate.event || dragDropDay.event;
  const newEventRect = dragCreate.rect || dragDropDay.rect;


  // Prefilter events that are in this day
  const events = useMemo(() => {
    // End of day
    const end = moment(start).add(1, 'day');

    return props.events.filter((e) => {
      const estart = moment(e.start);
      return estart.isBefore(end) && (e.end && moment(e.end).isAfter(start) || e.all_day && estart.isAfter(start));
    });
  }, [start, props.events]);
  
  // Events that should be displayed in all day section
  const allDayEvents = useMemo(() => {
    // Filter events
    return events
      .filter((e) => e.all_day || e.end && moment(e.end).subtract(1, 'day').isAfter(e.start))
      .map((e) => {
        const start = moment(e.start).startOf('day');
        const end = moment(e.end || e.start).endOf('day');

        return {
          ...e,
          start, end,
          has_prev: start.day() !== props.time.day(),
          has_next: end.day() !== props.time.day(),
        };
      })
      .sort((a, b) => {
        return (a.start.unix() - b.start.unix()) || (a.end.unix() - b.end.unix()) || (b.title.length - a.title.length);
      });
  }, [events]);

  // Scroll to current time on mount
  useEffect(() => {
    if (!scrollAreaRef.current) return;
    scrollAreaRef.current.scrollTo({
      top: scrollAreaRef.current.scrollHeight / 24 * moment().hours() - scrollAreaRef.current.clientHeight / 2,
    });
  }, [scrollAreaRef]);


  return (
    <Flex direction='column' h={0} w='100%' mt={4} sx={{ flexGrow: 1 }}>
      {/* Day label */}
      <Stack spacing={0} align='center' sx={(theme) => ({
        flex: '1 1 0px',
        paddingTop: '0.1rem',
        paddingBottom: '0.25rem',
      })}>
        <Text color='dimmed'>{start.format('ddd')}</Text>
        <Title order={3}>{start.format('D')}</Title>
      </Stack>

      {/* All day events */}
      <Flex sx={{ position: 'relative' }}>
        <Box sx={{
          width: props.style.timeGutter,
          borderBottom: `1px solid ${props.style.colors.cellBorder}`,
          minHeight: '1.0rem',
        }} />

        <Box sx={(theme) => ({
          flex: '1 1 0px',
          backgroundColor: start.isSame(moment(), 'date') ? theme.colors.dark[6] : undefined,
          borderLeft: `1px solid ${props.style.colors.cellBorder}`,
          borderBottom: `1px solid ${props.style.colors.cellBorder}`,
          minHeight: '1.0rem',
          height: `calc(${allDayEvents.length * 1.75}rem + 1px)`,
        })} />

        {allDayEvents.map((e, i) => (
          <EventButton
            key={e.id}
            event={e}
            popoverPosition='bottom-start'

            sx={(theme) => ({
              position: 'absolute',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              width: `calc((100% - ${props.style.timeGutter}px)${e.has_next ? '' : ' * 0.95'})`,
              height: '1.625rem',
              top: `${i * 1.75}rem`,
              left: props.style.timeGutter,

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
          </EventButton>
        ))}
      </Flex>

      <ScrollArea viewportRef={scrollAreaRef} sx={{ flexGrow: 1 }} viewportProps={{ style: { maxWidth: '100%' } }}>
        <Flex
          w='100%'
          maw='100%'
          sx={{ position: 'relative' }}
          onMouseMove={(ev)=> {
            dragDropDay.onMouseMove?.(ev);
            dragCreate.onMouseMove?.(ev);
          }}
        >
          <Stack align='flex-end' sx={(theme) => ({
            width: props.style.timeGutter,
            paddingTop: `calc(${props.style.slotHeight} - ${theme.fontSizes.xs} / 2 - 0.0625rem)`,
            paddingRight: '0.375rem',
            gap: `calc(${props.style.slotHeight} - ${theme.fontSizes.xs})`,
          })}>
            {range(23).map((i) => (
              <Text key={i} size='xs' weight={600} color='dimmed' sx={{ lineHeight: 1 }}>
                {moment(start).add(i + 1, 'hour').format('LT')}
              </Text>
            ))}
          </Stack>

          <TimeColumn
            day={start}
            events={events}
            editable={props.editable}
            style={props.style}

            draggedId={dragDropDay.event?.id}
            onDragStart={dragDropDay.onDragStart}
            onDragCreateStart={(offsetY) => dragCreate.onDragStart(0, offsetY)}
            onClickCreate={(gridY) => {
              props.onNewEventRequest?.(
                moment(start).add(gridY, 'hours')
              );
            }}
          />

          {newEventObj && newEventRect && (
            <Box
              sx={(theme) => {
                return {
                  position: 'absolute',
                  overflow: 'hidden',
                  width: newEventRect.w * 0.95,
                  height: newEventRect.h,
                  top: newEventRect.y,
                  left: newEventRect.x,
                  boxShadow: `0px 0px 16px #00000030`,
                  cursor: 'grab',
                  userSelect: 'none',

                  padding: '0.1rem 0.4rem',
                  paddingLeft: '0.75rem',
                  marginBottom: '0.25rem',
                  marginLeft: '0.25rem',
                  background: `linear-gradient(to right, ${newEventObj.color || theme.colors.gray[6]} 0.25rem, color-mix(in srgb, ${newEventObj.color || theme.colors.gray[6]} 20%, ${theme.colors.dark[7]}) 0)`,
                  fontSize: theme.fontSizes.sm,
                  borderRadius: theme.radius.sm,
                };
              }}
            >
              <Text color='dimmed' weight={600} size={11}>
                {draggedEventTimes.start.format('LT')} - {draggedEventTimes.end?.format('LT')}
              </Text>
              <Text weight={600} maw='100%' sx={{
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {newEventObj.title}
              </Text>
            </Box>
          )}
        </Flex>
      </ScrollArea>
    </Flex>
  );
}
