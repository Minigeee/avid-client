import {
  MouseEventHandler,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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

import {
  useCalendarContext,
  useDragCreate,
  useDraggableGridEvents,
} from './hooks';
import { CalendarStyle, MomentCalendarEvent } from './types';

import moment, { Moment } from 'moment';
import { range } from 'lodash';
import assert from 'assert';
import { getAllRepeatEvents, hasRepeatEvent } from './funcs';

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
  const [draggedEvent, setDraggedEvent] = useState<MomentCalendarEvent | null>(
    null,
  );
  // Drag offset
  const [offset, setOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  // Dragged position
  const [eventRect, setEventRect] = useState<{
    x: number;
    w: number;
    has_prev: boolean;
    has_next: boolean;
  } | null>(null);

  // Tracks current dragged event's grid position
  const gridPosX = useRef<number | null>(null);

  // Called on event drag start
  const onDragStart = useCallback(
    (e: MomentCalendarEvent, offset: { x: number; y: number }) => {
      setDraggedEvent(e);

      // Calculate actual x-offset based on start time of event
      const estart = moment(e.start).startOf('day');
      const weekOffset = estart.isBefore(props.start)
        ? props.start.diff(estart, 'days')
        : 0;

      const unitX =
        ((props.containerRef.current?.scrollWidth || 0) - props.timeGutter) /
        (props.cols || 7);
      setOffset({
        x: offset.x + weekOffset * unitX - (offset.x % unitX),
        y: offset.y,
      });
    },
    [props.start],
  );

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
      const duration = draggedEvent.end
        ? moment(draggedEvent.end)
            .endOf('day')
            .diff(moment(draggedEvent.start).startOf('day'), 'days') + 1
        : 1;
      const unitX = (container.clientWidth - props.timeGutter) / cols;
      const gridX = Math.max(
        -duration + 1,
        Math.min(Math.floor((left - props.timeGutter) / unitX), 6),
      );
      const snappedX = gridX * unitX + props.timeGutter;

      if (!eventRect || snappedX != eventRect.x) {
        const hasPrev = gridX < 0;
        const hasNext = gridX + duration > cols;

        const width =
          duration +
          (hasPrev ? gridX : 0) -
          (hasNext ? duration - (7 - gridX) : 0);

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
export type UseDragCreateMultidayProps = {
  /** Used to calculate grid */
  containerRef: RefObject<HTMLDivElement>;
  /** Size of time gutter (px) */
  gutterSize: number;
  /** Number of cols in grid */
  cols: number;

  /** Called when mouse let go */
  onCreate?: (start: { x: number }, duration: number) => void;
};

////////////////////////////////////////////////////////////
export function useDragCreateMultiday(props: UseDragCreateMultidayProps) {
  // Starting x pos in grid coords
  const [startX, setStartX] = useState<number | null>(null);
  const [newEvent, setNewEvent] = useState<MomentCalendarEvent | null>(null);
  // Dragged position
  const [eventRect, setEventRect] = useState<{
    x: number;
    w: number;
    has_prev: boolean;
    has_next: boolean;
  } | null>(null);

  // Tracks current dragged event's grid position
  const gridPos = useRef<{ x: number; duration: number } | null>(null);

  // Called when drag starts in column
  const onDragStart = useCallback(
    (offsetX: number) => {
      // Snap start x to grid
      let gridX = 0;

      const container = props.containerRef.current;
      if (container) {
        const unitX = (container.clientWidth - props.gutterSize) / props.cols;
        gridX = Math.max(
          0,
          Math.min(
            Math.floor((offsetX - props.gutterSize) / unitX),
            props.cols - 1,
          ),
        );
      }

      setStartX(gridX);
    },
    [props.gutterSize],
  );

  // Called on mouse move (only when col being dragged)
  const onMouseMove = useMemo(() => {
    const container = props.containerRef.current;
    if (!container || startX === null) return undefined;

    const cols = props.cols || 7;

    return ((e) => {
      // Calculate position relative to scroll area
      const rect = container.getBoundingClientRect();
      const left = e.clientX - rect.x - props.gutterSize;

      // Snap to grid
      const unitX = (rect.width - props.gutterSize) / cols;
      const gridX = Math.max(0, Math.min(Math.floor(left / unitX), cols - 1));

      // Start end days
      const day1 = startX;
      const day2 = gridX;

      const start = Math.min(day1, day2);
      const end = Math.max(day1, day2);
      const duration = end - start + 1;

      if (!eventRect || gridPos.current?.duration !== duration) {
        const startC = start;
        const endC = end;

        // List of event rects
        const rect = {
          x: startC,
          w: duration,
        };

        // Set temp event
        setNewEvent({
          id: '__temp__',
          channel: '',
          title: 'New Event',
          start: moment(),
          end: moment(),
          time_created: '',
        });

        // Convert rects to pixels
        setEventRect({
          x: rect.x * unitX + props.gutterSize,
          w: rect.w * unitX,
          has_prev: false,
          has_next: false,
        });

        // Update grid pos
        gridPos.current = { x: startC, duration };
      }
    }) as MouseEventHandler<HTMLDivElement>;
  }, [eventRect, startX]);

  // Called on mouse up event
  useEffect(() => {
    function onMouseUp() {
      // Callback
      if (gridPos.current) {
        props.onCreate?.({ x: gridPos.current.x }, gridPos.current.duration);
      }

      setStartX(null);
      setEventRect(null);
      setNewEvent(null);
      gridPos.current = null;
    }

    if (startX !== null) {
      window.addEventListener('mouseup', onMouseUp);

      return () => {
        window.removeEventListener('mouseup', onMouseUp);
      };
    }
  }, [startX]);

  return {
    onDragStart,
    onMouseMove,
    event: newEvent,
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
  onNewEventRequest?: (
    start: Moment,
    initial?: { duration?: number; all_day?: boolean },
  ) => void;
};

////////////////////////////////////////////////////////////
export default function WeekView(props: WeekViewProps) {
  const theme = useMantineTheme();
  const calendar = useCalendarContext();

  // Scroll area
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  // Multiday view
  const multidayViewRef = useRef<HTMLDivElement>(null);
  // Used to track if multiday drag state
  const multidayDragStateRef = useRef<'up' | 'down' | 'dragging'>('up');

  // The start of the week
  const start = useMemo(() => moment(props.time).startOf('week'), [props.time]);

  // Called when event is dropped
  const onEventDrop = useCallback(
    (
      e: MomentCalendarEvent,
      gridPos: { x: number; y: number },
      resizing?: boolean,
    ) => {
      // Get original event
      const origEvent = e;
      let start: Moment, end: Moment;

      // Calculate new times
      const estart = moment(origEvent.start);

      if (resizing) {
        start = estart;
        end = moment(start).startOf('day').add({ h: gridPos.y });
      } else {
        // Event duration
        const duration = origEvent.end
          ? moment(origEvent.end).diff(estart)
          : moment({ h: 1 }).unix();

        start = moment(props.time)
          .startOf('week')
          .add(gridPos.x, 'days')
          .add(
            gridPos.y >= 0
              ? gridPos.y
              : estart.diff(moment(estart).startOf('day'), 'minutes') / 60,
            'hours',
          );
        end = moment(start).add(duration);
      }

      if (end.isBefore(start)) {
        const temp = start;
        start = end;
        end = temp;
      }

      // User callback
      calendar.onEditEvent.current?.({ start, end }, origEvent);
    },
    [props.time],
  );

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
        { duration },
      );
    },
  });

  // Drag create events
  const dragCreateMultiday = useDragCreateMultiday({
    gutterSize: props.style.timeGutter,
    containerRef: multidayViewRef,
    cols: 7,
    onCreate: (startIdx, duration) => {
      props.onNewEventRequest?.(moment(start).add(startIdx.x, 'days'), {
        duration: 24 * duration - 1,
        all_day: true,
      });
    },
  });

  // Update dragged event times
  const draggedEventTimes = useMemo(() => {
    if (dragCreate.event) return dragCreate.event;

    const { event, gridPos, resizing } = dragDropDay;
    if (!event || !gridPos) return { start: moment(), end: moment() };
    let start: Moment, end: Moment;

    if (resizing) {
      start = moment(event.start);
      end = moment(start)
        .startOf('day')
        .add({ h: gridPos.y / 4 });
    } else {
      const duration = event.end
        ? event.end.diff(event.start)
        : moment({ h: 1 }).unix();
      start = moment({ h: gridPos.y / 4 });
      end = moment(start).add(duration);
    }

    if (end.isBefore(start)) {
      const temp = start;
      start = end;
      end = temp;
    }

    return { start, end };
  }, [
    dragDropDay.gridPos?.x,
    dragDropDay.gridPos?.y,
    dragCreate.event?.start,
    dragCreate.event?.end,
  ]);

  const newEventObj = dragCreate.event || dragDropDay.event;
  const newEventRect = dragCreate.rect || dragDropDay.rect;

  const newMultidayEventObj =
    dragCreateMultiday.event || dragDropMultiday.event;
  const newMultidayEventRect = dragCreateMultiday.rect || dragDropMultiday.rect;

  // Prefilter events that are in this week
  const events = useMemo(() => {
    // End of week
    const end = moment(start).add(1, 'week');

    return props.events.filter((e) => {
      const estart = moment(e.start);
      return (
        estart.isBefore(end) &&
        ((e.end &&
          (moment(e.end).isAfter(start) ||
            (e.repeat &&
              (!e.repeat.end_on || moment(e.repeat.end_on).isAfter(start))))) ||
          (e.all_day && estart.isAfter(start)))
      );
    });
  }, [start, props.events]);

  // Events that should be displayed in all day section
  const { filtered: allDayEvents, maxNumColumns: numAllDayRows } =
    useMemo(() => {
      // Filter events
      const prefiltered = events.filter(
        (e) =>
          e.all_day ||
          (e.end && moment(e.end).subtract(1, 'day').isAfter(e.start)),
      );

      const filtered: (Omit<CalendarEvent, 'start' | 'end'> & {
        start: Moment;
        end: Moment;
        left: number;
        top: number;
        width: number;
        has_prev: boolean;
        has_next: boolean;
      })[] = [];

      // Add all day events, including repeat events
      for (const e of prefiltered) {
        if (e.repeat) {
          filtered.push(
            ...getAllRepeatEvents(start, e).map((e) => ({
              ...e,
              left: 0,
              width: 1,
              top: 0,
              has_prev: false,
              has_next: false,
            })),
          );
        } else {
          filtered.push({
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
      }

      filtered.sort((a, b) => {
        return (
          a.start.unix() - b.start.unix() ||
          a.end.unix() - b.end.unix() ||
          b.title.length - a.title.length
        );
      });

      // Grid of event columns
      let columns: (typeof filtered)[] = [];
      // Tracks the last event ending
      let lastEventEnding: Moment | null = null;
      // Max number of columns
      let maxNumColumns = 0;

      // Checks if date ranges collide
      function collides(
        a: { start: Moment; end: Moment },
        b: { start: Moment; end: Moment },
      ) {
        return a.start.isBefore(b.end) && a.end.isAfter(b.start);
      }

      // Packs events
      function packEvents(columns: (typeof filtered)[]) {
        for (let i = 0; i < columns.length; ++i) {
          const col = columns[i];

          for (const e of col) e.top = i;
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

          if (columns.length > maxNumColumns) maxNumColumns = columns.length;
        }
        if (!lastEventEnding || e.end > lastEventEnding)
          lastEventEnding = e.end;
      }

      if (columns.length > 0) packEvents(columns);

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
      top:
        (scrollAreaRef.current.scrollHeight / 24) * moment().hours() -
        scrollAreaRef.current.clientHeight / 2,
    });
  }, [scrollAreaRef]);

  // WIP : Make calendar texts unhighlightable: all event button texts, month date label texts

  return (
    <Flex
      direction='column'
      h={0}
      w='100%'
      mt={8}
      sx={{ flexGrow: 1 }}
      onMouseMove={(ev) => {
        dragCreateMultiday.onMouseMove?.(ev);
        dragDropMultiday.onMouseMove?.(ev);
      }}
    >
      {/* Day labels */}
      <Flex ml={props.style.timeGutter}>
        {range(7).map((i) => {
          const date = moment(start).add(i, 'day');
          const isToday = date.isSame(moment(), 'date');

          return (
            <UnstyledButton
              key={i}
              sx={(theme) => ({
                flex: '1 1 0px',
                paddingTop: '0.125rem',
                paddingBottom: '0.3125rem',
                borderTopRightRadius: theme.radius.sm,
                borderTopLeftRadius: theme.radius.sm,
                borderBottomLeftRadius: isToday ? 0 : theme.radius.sm,
                borderBottomRightRadius: isToday ? 0 : theme.radius.sm,
                background: isToday
                  ? theme.other.elements.calendar_today
                  : undefined,
                transition: 'background 0.18s',
                userSelect: 'none',

                '&:hover': {
                  background: isToday
                    ? theme.other.elements.calendar_today_hover
                    : theme.other.elements.calendar_hover,
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
        onMouseDown={
          props.editable
            ? (ev) => {
                // Only LMB
                if (ev.button !== 0) return;

                // Down
                multidayDragStateRef.current = 'down';
              }
            : undefined
        }
        onMouseUp={
          props.editable
            ? (ev) => {
                // Quit if not mouse down
                if (multidayDragStateRef.current !== 'down') return;

                // Reset to up
                multidayDragStateRef.current = 'up';

                const rect = ev.currentTarget.getBoundingClientRect();
                const unitX = (rect.width - props.style.timeGutter) / 7;

                props.onNewEventRequest?.(
                  moment(start).add(
                    Math.floor(
                      (ev.pageX - rect.x - props.style.timeGutter) / unitX,
                    ),
                    'days',
                  ),
                  {
                    duration: 23,
                    all_day: true,
                  },
                );
              }
            : undefined
        }
        onMouseMove={
          props.editable
            ? (ev) => {
                // Quit if not mouse down
                if (multidayDragStateRef.current !== 'down') return;

                // Dragging
                multidayDragStateRef.current = 'dragging';

                const rect = ev.currentTarget.getBoundingClientRect();
                dragCreateMultiday.onDragStart(ev.pageX - rect.x);
              }
            : undefined
        }
        draggable={false}
      >
        <Box
          sx={{
            width: props.style.timeGutter,
            borderBottom: `1px solid ${props.style.colors.cellBorder}`,
            minHeight: '1.25rem',
          }}
        />

        {range(7).map((i) => (
          <Box
            key={i}
            sx={{
              flex: '1 1 0px',
              background: moment(start).add(i, 'day').isSame(moment(), 'date')
                ? theme.other.elements.calendar_today
                : undefined,
              borderLeft: `1px solid ${props.style.colors.cellBorder}`,
              borderBottom: `1px solid ${props.style.colors.cellBorder}`,
              minHeight: '1.25rem',
              height: `calc(${
                (numAllDayRows > 0
                  ? numAllDayRows
                  : newMultidayEventObj
                    ? 1
                    : 0) * 1.75
              }rem + 1px)`,
            }}
          />
        ))}

        {allDayEvents.map((e, i) => (
          <EventButton
            key={e.id + (e.repeat ? '-' + i : '')}
            event={e}
            popoverPosition='bottom-start'
            sx={(theme) => ({
              position: 'absolute',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              width: `calc((100% - ${props.style.timeGutter}px) * ${
                e.width - (e.has_next ? 0 : 0.05)
              } / 7)`,
              height: '1.625rem',
              top: `${e.top * 1.75}rem`,
              left: `calc(${e.left} / 7 * (100% - ${
                props.style.timeGutter
              }px) + ${props.style.timeGutter + 1}px)`,
              cursor: 'pointer',
              opacity: newMultidayEventObj?.id === e.id ? 0.6 : undefined,

              padding: '0.125rem 0.4rem',
              paddingLeft: '0.75rem',
              background: e.has_prev
                ? `color-mix(in srgb, ${
                    e.color || props.style.colors.event
                  } 20%, ${theme.other.elements.calendar_block_event})`
                : `linear-gradient(to right, ${
                    e.color || props.style.colors.event
                  } 0.25rem, color-mix(in srgb, ${
                    e.color || props.style.colors.event
                  } 20%, ${theme.other.elements.calendar_block_event}) 0)`,
              color: theme.other.elements.calendar_block_event_text,
              fontSize: theme.fontSizes.sm,
              borderTopLeftRadius: e.has_prev ? 0 : theme.radius.sm,
              borderBottomLeftRadius: e.has_prev ? 0 : theme.radius.sm,
              borderTopRightRadius: e.has_next ? 0 : theme.radius.sm,
              borderBottomRightRadius: e.has_next ? 0 : theme.radius.sm,
            })}
            draggable={props.editable}
            onDragStart={
              props.editable
                ? (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();

                    const rect = ev.currentTarget.getBoundingClientRect();
                    const offset = {
                      x: ev.pageX - rect.x,
                      y: ev.pageY - rect.y,
                    };

                    // console.log('drag', offset);
                    dragDropMultiday.onDragStart(e, offset);
                  }
                : undefined
            }
            onMouseDown={(ev) => {
              ev.stopPropagation();
            }}
          >
            {e.title}
          </EventButton>
        ))}

        {newMultidayEventObj && newMultidayEventRect && (
          <Box
            sx={(theme) => ({
              position: 'absolute',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              width: newMultidayEventRect?.w,
              height: '1.625rem',
              top: 0,
              left: newMultidayEventRect?.x,
              boxShadow: theme.other.elements.calendar_block_event_shadow,
              cursor: 'grab',
              userSelect: 'none',

              padding: '0.125rem 0.4rem',
              paddingLeft: '0.75rem',
              background: newMultidayEventRect?.has_prev
                ? `color-mix(in srgb, ${
                    newMultidayEventObj?.color || props.style.colors.event
                  } 20%, ${theme.other.elements.calendar_block_event})`
                : `linear-gradient(to right, ${
                    newMultidayEventObj?.color || props.style.colors.event
                  } 0.25rem, color-mix(in srgb, ${
                    newMultidayEventObj?.color || props.style.colors.event
                  } 20%, ${theme.other.elements.calendar_block_event}) 0)`,
              color: theme.other.elements.calendar_block_event_text,
              fontSize: theme.fontSizes.sm,
              borderTopLeftRadius: newMultidayEventRect?.has_prev
                ? 0
                : theme.radius.sm,
              borderBottomLeftRadius: newMultidayEventRect?.has_prev
                ? 0
                : theme.radius.sm,
              borderTopRightRadius: newMultidayEventRect?.has_next
                ? 0
                : theme.radius.sm,
              borderBottomRightRadius: newMultidayEventRect?.has_next
                ? 0
                : theme.radius.sm,
            })}
          >
            {newMultidayEventObj.title}
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
          <Stack
            align='flex-end'
            sx={(theme) => ({
              width: props.style.timeGutter,
              paddingTop: `calc(${props.style.slotHeight} - ${theme.fontSizes.xs} / 2 - 0.0625rem)`,
              paddingRight: '0.375rem',
              gap: `calc(${props.style.slotHeight} - ${theme.fontSizes.xs})`,
            })}
          >
            {range(23).map((i) => (
              <Text
                key={i}
                size='xs'
                weight={600}
                color='dimmed'
                sx={{ lineHeight: 1, userSelect: 'none' }}
              >
                {moment({ hours: i + 1 }).format('LT')}
              </Text>
            ))}
          </Stack>

          {range(7).map((i) => (
            <TimeColumn
              key={i}
              day={moment(start).add(i, 'day')}
              events={events}
              editable={props.editable}
              style={props.style}
              draggedId={dragDropDay.event?.id}
              onDragStart={dragDropDay.onDragStart}
              onDragCreateStart={(offsetY) =>
                dragCreate.onDragStart(i, offsetY)
              }
              onClickCreate={(gridY) => {
                props.onNewEventRequest?.(
                  moment(start).add(i, 'days').add(gridY, 'hours'),
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
                  boxShadow: theme.other.elements.calendar_block_event_shadow,
                  cursor: 'grab',
                  userSelect: 'none',

                  padding: '0.1rem 0.4rem',
                  paddingLeft: '0.75rem',
                  marginBottom: '0.25rem',
                  marginLeft: '0.25rem',
                  background: `linear-gradient(to right, ${
                    newEventObj.color || theme.colors.gray[6]
                  } 0.25rem, color-mix(in srgb, ${
                    newEventObj.color || theme.colors.gray[6]
                  } 20%, ${theme.other.elements.calendar_block_event}) 0)`,
                  color: theme.other.elements.calendar_block_event_text,
                  fontSize: theme.fontSizes.sm,
                  borderRadius: theme.radius.sm,
                };
              }}
            >
              <Text color='dimmed' weight={600} size={11}>
                {draggedEventTimes.start.format('LT')} -{' '}
                {draggedEventTimes.end?.format('LT')}
              </Text>
              <Text
                weight={600}
                maw='100%'
                sx={{
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {newEventObj.title}
              </Text>
            </Box>
          )}
        </Flex>
      </ScrollArea>
    </Flex>
  );
}
