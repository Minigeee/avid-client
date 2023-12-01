import { MouseEventHandler, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Box,
  Flex,
  ScrollArea,
  Stack,
  Text,
  Title,
  UnstyledButton,
  useMantineTheme,
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
type UseDraggableMultidayWeekProps = {
  /** The start of the week */
  start: Moment;
  /** Used to calculate grid */
  containerRef: RefObject<HTMLDivElement>;
  /** Size of time gutter (px) */
  timeGutter: number;
  /** Number of columns to include in grid (default 7) */
  cols?: number;

  /** Called when event is dropped */
  onDrop?: (e: MomentCalendarEvent, gridPos: { x: number; y: number }) => void;
};

////////////////////////////////////////////////////////////
function useDraggableMultidayWeek(props: UseDraggableMultidayWeekProps) {
  // Event being dragged
  const [draggedEvent, setDraggedEvent] = useState<MomentCalendarEvent | null>(null);
  // Drag offset
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // Dragged position
  const [eventRect, setEventRect] = useState<{ x: number; w: number; has_prev: boolean; has_next: boolean } | null>(null);

  // Tracks current dragged event's grid position
  const gridPosX = useRef<number | null>(null);


  // Called on event drag start
  const onDragStart = useCallback((e: MomentCalendarEvent, offset: { x: number; y: number }) => {
    setDraggedEvent(e);

    // Calculate actual x-offset based on start time of event
    const estart = moment(e.start).startOf('day');
    const weekOffset = estart.isBefore(props.start) ? props.start.diff(estart, 'days') : 0;

    const unitX = ((props.containerRef.current?.scrollWidth || 0) - props.timeGutter) / (props.cols || 7);
    setOffset({ x: offset.x + weekOffset * unitX - offset.x % unitX, y: offset.y });
  }, [props.start]);

  // Called on mouse move (only when event being dragged)
  const onMouseMove = useMemo(() => {
    const container = props.containerRef.current;
    if (!draggedEvent || !container) return undefined;

    const cols = props.cols || 7;

    return ((e) => {

      // Calculate position of event relative to container
      const rect = container.getBoundingClientRect();
      const left = e.clientX - rect.x - offset.x;

      // Snap to grid
      const duration = draggedEvent.end ? moment(draggedEvent.end).endOf('day').diff(moment(draggedEvent.start).startOf('day'), 'days') + 1 : 1;
      const unitX = (container.clientWidth - props.timeGutter) / cols;
      const gridX = Math.max(-duration + 1, Math.min(Math.floor((left - props.timeGutter) / unitX), 6));
      const snappedX = gridX * unitX + props.timeGutter;

      if (!eventRect || snappedX != eventRect.x) {
        const hasPrev = gridX < 0;
        const hasNext = gridX + duration > cols;

        const width = duration + (hasPrev ? gridX : 0) - (hasNext ? duration - (7 - gridX) : 0);

        // Set event rect
        setEventRect({
          x: Math.max(snappedX, props.timeGutter) + 1,
          w: (width - (hasNext ? 0 : 0.05)) * unitX,
          has_prev: hasPrev,
          has_next: hasNext,
        });

        // Update grid pos
        gridPosX.current = gridX;
      }
    }) as MouseEventHandler<HTMLDivElement>;
  }, [draggedEvent, eventRect]);

  // Called on mouse up event
  useEffect(() => {
    function onMouseUp() {
      // Callback
      if (draggedEvent && gridPosX.current) {
        props.onDrop?.(draggedEvent, { x: gridPosX.current, y: -1 });
      }

      setDraggedEvent(null);
      setEventRect(null);
      gridPosX.current = null;
    }

    if (draggedEvent) {
      window.addEventListener('mouseup', onMouseUp);

      return () => {
        window.removeEventListener('mouseup', onMouseUp);
      };
    }
  }, [draggedEvent]);


  return {
    onDragStart,
    onMouseMove,
    event: draggedEvent,
    rect: eventRect,
  };
}


////////////////////////////////////////////////////////////
export type WeekViewProps = {
  /** A date within the week that should be displayed */
  time: Moment;
  /** List of events from the calendar */
  events: CalendarEvent[];

  /** Are events editable */
  editable: boolean;
  /** Calendar styles */
  style: CalendarStyle;
  /** For jumping to day view */
  setDay: (day: Moment) => void;

  /** Called when a new event should be created */
  onNewEventRequest?: (start: Moment, initial?: { duration?: number, all_day?: boolean }) => void;
  /** Called when an event changes */
  onEventChange?: (id: string, event: Partial<CalendarEvent>) => void;
};

////////////////////////////////////////////////////////////
export default function WeekView(props: WeekViewProps) {
  const theme = useMantineTheme();

  // Scroll area
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  // Multiday view
  const multidayViewRef = useRef<HTMLDivElement>(null);

  // The start of the week
  const start = useMemo(() => moment(props.time).startOf('week'), [props.time]);


  // Called when event is dropped
  const onEventDrop = useCallback((e: MomentCalendarEvent, gridPos: { x: number; y: number }) => {
    // Get original event
    const origEvent = props.events.find((x) => x.id === e.id) || e;

    // Calculate new times
    const estart = moment(origEvent.start);
    const duration = origEvent.end ? moment(origEvent.end).diff(estart) : moment({ h: 1 }).unix();
    const start = moment(props.time).startOf('week').add(gridPos.x, 'days').add(gridPos.y >= 0 ? gridPos.y : estart.diff(moment(estart).startOf('day'), 'minutes') / 60, 'hours');
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
    subdivisions: 4,
    onDrop: onEventDrop,
  });

  // Drag drop for multiday events
  const dragDropMultiday = useDraggableMultidayWeek({
    start,
    containerRef: multidayViewRef,
    timeGutter: props.style.timeGutter,
    onDrop: onEventDrop,
  });

  // Drag create events
  const dragCreate = useDragCreate({
    containerRef: scrollAreaRef,
    timeGutter: props.style.timeGutter,
    rows: 24 * 4,
    cols: 7,
    subdivisions: 4,
    onCreate: (startIdx, duration) => {
      props.onNewEventRequest?.(
        moment(start).add(startIdx.x, 'days').add(startIdx.y, 'hours'),
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

  // WIP : Make calendar texts unhighlightable: all event button texts, month date label texts


  return (
    <Flex direction='column' h={0} w='100%' mt={8} sx={{ flexGrow: 1 }}>
      {/* Day labels */}
      <Flex ml={props.style.timeGutter}>
        {range(7).map((i) => {
          const date = moment(start).add(i, 'day');
          const isToday = date.isSame(moment(), 'date');

          return (
            <UnstyledButton
              sx={(theme) => ({
                flex: '1 1 0px',
                paddingTop: '0.125rem',
                paddingBottom: '0.3125rem',
                borderTopRightRadius: theme.radius.sm,
                borderTopLeftRadius: theme.radius.sm,
                borderBottomLeftRadius: isToday ? 0 : theme.radius.sm,
                borderBottomRightRadius: isToday ? 0 : theme.radius.sm,
                backgroundColor: isToday ? theme.colors.dark[6] : undefined,
                transition: 'background-color 0.18s',

                '&:hover': {
                  backgroundColor: theme.colors.dark[isToday ? 5 : 6],
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
      <Flex
        ref={multidayViewRef}
        sx={{ position: 'relative' }}
        onMouseMove={dragDropMultiday.onMouseMove}
      >
        <Box sx={{
          width: props.style.timeGutter,
          borderBottom: `1px solid ${props.style.colors.cellBorder}`,
          minHeight: '1.25rem',
        }} />

        {range(7).map((i) => (
          <Box sx={{
            flex: '1 1 0px',
            backgroundColor: moment(start).add(i, 'day').isSame(moment(), 'date') ? theme.colors.dark[6] : undefined,
            borderLeft: `1px solid ${props.style.colors.cellBorder}`,
            borderBottom: `1px solid ${props.style.colors.cellBorder}`,
            minHeight: '1.25rem',
            height: `calc(${numAllDayRows * 1.75}rem + 1px)`
          }} />
        ))}

        {allDayEvents.map((e) => (
          <EventButton
            event={e}
            popoverPosition='bottom-start'

            sx={(theme) => ({
              position: 'absolute',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              width: `calc((100% - ${props.style.timeGutter}px) * ${e.width - (e.has_next ? 0 : 0.05)} / 7)`,
              height: '1.625rem',
              top: `${e.top * 1.75}rem`,
              left: `calc(${e.left} / 7 * (100% - ${props.style.timeGutter}px) + ${props.style.timeGutter + 1}px)`,
              cursor: 'pointer',
              opacity: dragDropMultiday.event?.id === e.id ? 0.6 : undefined,

              padding: '0.125rem 0.4rem',
              paddingLeft: '0.75rem',
              background: e.has_prev ? `color-mix(in srgb, ${e.color || props.style.colors.event} 20%, ${theme.colors.dark[7]})` : `linear-gradient(to right, ${e.color || props.style.colors.event} 0.25rem, color-mix(in srgb, ${e.color || props.style.colors.event} 20%, ${theme.colors.dark[7]}) 0)`,
              fontSize: theme.fontSizes.sm,
              borderTopLeftRadius: e.has_prev ? 0 : theme.radius.sm,
              borderBottomLeftRadius: e.has_prev ? 0 : theme.radius.sm,
              borderTopRightRadius: e.has_next ? 0 : theme.radius.sm,
              borderBottomRightRadius: e.has_next ? 0 : theme.radius.sm,
            })}
            draggable
            onDragStart={(ev) => {
              ev.preventDefault();

              const rect = ev.currentTarget.getBoundingClientRect();
              const offset = { x: ev.pageX - rect.x, y: ev.pageY - rect.y };

              // console.log('drag', offset);
              dragDropMultiday.onDragStart(e, offset);
            }}
          >
            {e.title}
          </EventButton>
        ))}

        {dragDropMultiday.event && dragDropMultiday.rect && (
          <Box
            sx={(theme) => ({
              position: 'absolute',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              width: dragDropMultiday.rect?.w,
              height: '1.625rem',
              top: 0,
              left: dragDropMultiday.rect?.x,
              boxShadow: `0px 0px 16px #00000030`,
              cursor: 'grab',

              padding: '0.125rem 0.4rem',
              paddingLeft: '0.75rem',
              background: dragDropMultiday.rect?.has_prev ?
                `color-mix(in srgb, ${dragDropMultiday.event?.color || props.style.colors.event} 20%, ${theme.colors.dark[7]})` :
                `linear-gradient(to right, ${dragDropMultiday.event?.color || props.style.colors.event} 0.25rem, color-mix(in srgb, ${dragDropMultiday.event?.color || props.style.colors.event} 20%, ${theme.colors.dark[7]}) 0)`,
              fontSize: theme.fontSizes.sm,
              borderTopLeftRadius: dragDropMultiday.rect?.has_prev ? 0 : theme.radius.sm,
              borderBottomLeftRadius: dragDropMultiday.rect?.has_prev ? 0 : theme.radius.sm,
              borderTopRightRadius: dragDropMultiday.rect?.has_next ? 0 : theme.radius.sm,
              borderBottomRightRadius: dragDropMultiday.rect?.has_next ? 0 : theme.radius.sm,
            })}
          >
            {dragDropMultiday.event.title}
          </Box>
        )}
      </Flex>

      <ScrollArea viewportRef={scrollAreaRef} sx={{ flexGrow: 1 }}>
        <Flex
          w='100%'
          sx={{ position: 'relative' }}
          onMouseMove={(ev) => {
            dragDropDay.onMouseMove?.(ev);
            // Allows mouse move events to be handled in this view too
            dragDropMultiday.onMouseMove?.(ev);
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
              <Text size='xs' weight={600} color='dimmed' sx={{ lineHeight: 1 }}>
                {moment({ hours: i + 1 }).format('LT')}
              </Text>
            ))}
          </Stack>

          {range(7).map((i) => (
            <TimeColumn
              day={moment(start).add(i, 'day')}
              events={events}
              editable={props.editable}
              style={props.style}

              draggedId={dragDropDay.event?.id}
              onDragStart={dragDropDay.onDragStart}
              onDragCreateStart={(offsetY) => dragCreate.onDragStart(i, offsetY)}
              onClickCreate={(gridY) => {
                props.onNewEventRequest?.(
                  moment(start).add(i, 'days').add(gridY, 'hours')
                );
              }}
            />
          ))}

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
