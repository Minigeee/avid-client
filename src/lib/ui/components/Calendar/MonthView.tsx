import { MouseEventHandler, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

import { useDraggableGridEvents } from './hooks';
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
  /** Size of header (px) */
  headerSize: number;
  /** Number of columns to include in grid (default 7) */
  cols?: number;
  /** Number of rows to include in grid */
  rows: number;

  /** Called when event is dropped */
  onDrop?: (e: MomentCalendarEvent, gridPos: { x: number; y: number }) => void;
};

////////////////////////////////////////////////////////////
function useDraggableMultidayMonth(props: UseDraggableMultidayWeekProps) {
  // Event being dragged
  const [draggedEvent, setDraggedEvent] = useState<MomentCalendarEvent | null>(null);
  // Drag offset
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // Dragged position
  const [eventRects, setEventRects] = useState<{ x: number; y: number; w: number; has_prev: boolean; has_next: boolean }[] | null>(null);

  // Tracks current dragged event's grid position (based on mouse pos)
	const gridPos = useRef<{ x: number; y: number } | null>(null);


  // Called on event drag start
  const onDragStart = useCallback((e: MomentCalendarEvent, position: { x: number; y: number }, offset: { x: number; y: number }) => {
    const container = props.containerRef.current;
    if (!container) return;

    const cols = props.cols || 7;

    // Set dragged event
    setDraggedEvent(e);

    // Get mouse grid pos
    const rect = container.getBoundingClientRect();
    const unitX = container.clientWidth / cols;
    const unitY = (container.clientHeight - props.headerSize) / props.rows;
    const gridY = Math.max(0, Math.min(Math.floor((position.y - rect.top - props.headerSize) / unitY), props.rows - 1));

    // The day the mouse is in
    const mouseTime = moment(props.start).add(gridY, 'weeks');

    // Extra offset
    const estart = moment(e.start).startOf('day');
    const extraOffset = Math.max(mouseTime.diff(estart, 'days'), 0);
    const newOffset = { x: offset.x + extraOffset * unitX - offset.x % unitX, y: offset.y };

    setOffset(newOffset);
    // console.log(newOffset);
  }, [props.start]);

  // Called on mouse move (only when event being dragged)
  const onMouseMove = useMemo(() => {
    const container = props.containerRef.current;
    if (!draggedEvent || !container) return undefined;

    const cols = props.cols || 7;

    return ((e) => {
      // Duration in days, grid unit sizes
      const unitX = container.clientWidth / cols;
      const unitY = (container.clientHeight - props.headerSize) / props.rows;

      // Mouse x offset in days
      const gridXOffset = offset.x / unitX;
      
      // Grid position of mouse
      const rect = container.getBoundingClientRect();
      const top = e.clientY - rect.top;
      const left = e.clientX - rect.left;
			const gridX = Math.max(0, Math.min(Math.floor(left / unitX), cols - 1));
      const gridY = Math.max(0, Math.min(Math.floor((top - props.headerSize) / unitY), props.rows - 1));
      
      // Update only if changed
      if (!eventRects || gridPos.current?.x !== gridX || gridPos.current?.y !== gridY) {
        const duration = draggedEvent.end ? moment(draggedEvent.end).endOf('day').diff(moment(draggedEvent.start).startOf('day'), 'days') + 1 : 1;

        // Get start of event
        let unboundX = gridX - gridXOffset;
        let startY = gridY + Math.floor(unboundX / cols);
        let startX = unboundX - Math.floor(unboundX / cols) * cols;

        // Get end of event
        unboundX = startX + duration - 1;
        let endY = startY + Math.floor(unboundX / cols);
        let endX = unboundX - Math.floor(unboundX / cols) * cols;

        // Clamp start and end y
        let hasPrev = false, hasNext = false;
        if (startY < 0) {
          startY = 0;
          startX = 0;
          hasPrev = true;
        }
        else if (startY >= props.rows) {
          startY = props.rows - 1;
          startX = 6;
        }
        
        if (endY < 0) {
          endY = 0;
          endX = 0;
        }
        else if (endY >= props.rows) {
          endY = props.rows - 1;
          endX = 6;
          hasNext = true;
        }

        // List of event rects
        const rects: { x: number; y: number; w: number; has_prev: boolean; has_next: boolean }[] = [];
        for (let r = startY; r <= endY; ++r) {
          rects.push({
            x: r === startY ? startX : 0,
            y: r,
            w: (r === endY ? endX : 6) - (r === startY ? startX : 0) + 1,
            has_prev: r !== startY || hasPrev,
            has_next: r !== endY || hasNext,
          });
        }

        // Convert rects to pixels
        for (const r of rects) {
          r.x = r.x * unitX;
          r.y = r.y * unitY + props.headerSize;
          r.w = r.w * unitX;
        }
        setEventRects(rects);

				// Update grid pos
        gridPos.current = { x: gridX, y: gridY };
      }
    }) as MouseEventHandler<HTMLDivElement>;
  }, [draggedEvent, eventRects]);

  // Called on mouse up event
  useEffect(() => {
    function onMouseUp() {
      // Callback
      if (props.containerRef.current && draggedEvent && gridPos.current) {
        const cols = props.cols || 7;

        // Get start of event
        const unitX = props.containerRef.current.clientWidth / cols;
        let unboundX = gridPos.current.x - offset.x / unitX;
        let startY = gridPos.current.y + Math.floor(unboundX / cols);
        let startX = unboundX - Math.floor(unboundX / cols) * cols;

        props.onDrop?.(draggedEvent, { x: startX, y: startY });
      }

      setDraggedEvent(null);
      setEventRects(null);
      gridPos.current = null;
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
    rects: eventRects,
  };
}


////////////////////////////////////////////////////////////
export type UseDragCreateProps = {
	/** Used to calculate grid */
	containerRef: RefObject<HTMLDivElement>;
	/** Size of header (px) */
	headerSize: number;
	/** Number of rows in grid */
	rows: number;
	/** Number of cols in grid */
	cols: number;

	/** Called when mouse let go */
	onCreate?: (start: { x: number; y: number }, duration: number) => void;
};

////////////////////////////////////////////////////////////
export function useDragCreate(props: UseDragCreateProps) {
	const [rowIdx, setRowIdx] = useState<number | null>(null);
	// Starting x pos in grid coords
	const [startX, setStartX] = useState<number | null>(null);
	const [newEvent, setNewEvent] = useState<MomentCalendarEvent | null>(null);
  // Dragged position
  const [eventRects, setEventRects] = useState<{ x: number; y: number; w: number; has_prev: boolean; has_next: boolean }[] | null>(null);
	
	// Tracks current dragged event's grid position
	const gridPos = useRef<{ x: number; y: number; duration: number } | null>(null);


	// Called when drag starts in column
	const onDragStart = useCallback((rowIdx: number, offsetX: number) => {
		// Snap start x to grid
		let gridX = 0;

		const container = props.containerRef.current;
		if (container) {
			const unitX = container.clientWidth / props.cols;
			gridX = Math.max(0, Math.min(Math.floor(offsetX / unitX), props.cols - 1));
		}

		setRowIdx(rowIdx);
		setStartX(gridX);
	}, []);

	// Called on mouse move (only when col being dragged)
	const onMouseMove = useMemo(() => {
		const container = props.containerRef.current;
		if (!container || startX === null || rowIdx === null) return undefined;

		const rows = props.rows;
		const cols = props.cols || 7;

		return ((e) => {
			// Calculate position relative to scroll area
			const rect = container.getBoundingClientRect();
			const left = e.clientX - rect.x;
			const top = e.clientY - rect.y - props.headerSize;

			// Snap to grid
			const unitX = rect.width / cols;
			const unitY = (rect.height - props.headerSize) / rows;
      const gridX = Math.max(0, Math.min(Math.floor(left / unitX), cols - 1))
			const gridY = Math.max(0, Math.min(Math.floor(top / unitY), rows - 1));

      // Start end days
      const day1 = rowIdx * cols + startX;
      const day2 = gridY * cols + gridX;

			const start = Math.min(day1, day2);
			const end = Math.max(day1, day2);
			const duration = end - start + 1;

			if (!eventRects || gridPos.current?.duration !== duration) {
        const startR = Math.floor(start / cols);
        const startC = start % cols;
        const endR = Math.floor(end / cols);
        const endC = end % cols;

        // List of event rects
        const rects: { x: number; y: number; w: number; has_prev: boolean; has_next: boolean }[] = [];
        for (let r = startR; r <= endR; ++r) {
          rects.push({
            x: r === startR ? startC : 0,
            y: r,
            w: (r === endR ? endC : 6) - (r === startR ? startC : 0) + 1,
            has_prev: r !== startR,
            has_next: r !== endR,
          });
        }

        // Convert rects to pixels
        for (const r of rects) {
          r.x = r.x * unitX;
          r.y = r.y * unitY + props.headerSize;
          r.w = r.w * unitX;
        }
        setEventRects(rects);

				// Set temp event
				setNewEvent({
					id: '__temp__',
					title: 'New Event',
					start: moment(),
					end: moment(),
					time_created: '',
				});

				// Update grid pos
        gridPos.current = { x: startC, y: startR, duration };
			}
		}) as MouseEventHandler<HTMLDivElement>;
	}, [rowIdx, eventRects]);

	// Called on mouse up event
	useEffect(() => {
		function onMouseUp() {
			// Callback
			if (rowIdx !== null && gridPos.current) {
				props.onCreate?.({ x: gridPos.current.x, y: gridPos.current.y }, gridPos.current.duration);
			}

			setNewEvent(null);
			setEventRects(null);
			setRowIdx(null);
			setStartX(null);
			gridPos.current = null;
		}

		if (rowIdx !== null) {
			window.addEventListener('mouseup', onMouseUp);

			return () => {
				window.removeEventListener('mouseup', onMouseUp);
			};
		}
	}, [rowIdx]);


	return {
		onDragStart,
		onMouseMove,
		event: newEvent,
		rects: eventRects,
	};
}


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
  
  /** The event that is currently being dragged */
  draggedId?: string | null;
  /** Called when an event is start drag */
  onDragStart: (event: MomentCalendarEvent, position: { x: number; y: number }, offset: { x: number; y: number }, multiday: boolean) => void;
  /** Called when a column drag start */
  onDragCreateStart?: (offsetX: number) => void;
  /** Called on click create */
  onClickCreate?: (gridX: number) => void;
};

////////////////////////////////////////////////////////////
function WeekRow(props: WeekRowProps) {
  // Used to track if row is being clicked
  const clickedRef = useRef<boolean>(false);


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
    <Flex
      w='100%'
      sx={{
        flex: '1 1 0px',
        position: 'relative',
      }}

      draggable
      onDragStart={(ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        const rect = ev.currentTarget.getBoundingClientRect();
        props.onDragCreateStart?.(ev.pageX - rect.x);

        // Reset
        clickedRef.current = false;
      }}
      onMouseDown={() => { clickedRef.current = true; }}
      onMouseUp={(ev) => {
        if (!clickedRef.current) return;

        const rect = ev.currentTarget.getBoundingClientRect();
        const unitX = rect.width / 7;

        props.onClickCreate?.(Math.floor((ev.pageX - rect.x) / unitX));

        // Reset
        clickedRef.current = false;
      }}
    >
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
            <Group position='right' p='0.125rem' h='2rem'>
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
                    opacity: props.draggedId === e.id ? 0.6 : inRange ? undefined : 0.8,

                    '&:hover': {
                      backgroundColor: theme.colors.dark[6],
                    },
                  })}

                  draggable
                  onDragStart={(ev) => {
                    ev.preventDefault();
        
                    const rect = ev.currentTarget.getBoundingClientRect();
                    const offset = { x: ev.pageX - rect.x, y: ev.pageY - rect.y };
        
                    // console.log('drag', offset);
                    props.onDragStart(e, { x: ev.pageX, y: ev.pageY }, offset, false);
                  }}
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
            opacity: props.draggedId === e.id ? 0.6 : undefined,
            cursor: 'pointer',

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
            props.onDragStart(e, { x: ev.pageX, y: ev.pageY }, offset, true);
          }}
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

  /** Called when a new event should be created */
  onNewEventRequest?: (start: Moment, initial?: { duration?: Moment, all_day?: boolean }) => void;
  /** Called when an event changes */
  onEventChange?: (id: string, event: Partial<CalendarEvent>) => void;
};

////////////////////////////////////////////////////////////
export default function MonthView(props: MonthViewProps) {
  // Container for month
  const containerRef = useRef<HTMLDivElement>(null);

  // The start/ of the month
  const monthRange = useMemo(() => {
    const start = moment(props.time).startOf('month');
    return [start, moment(start).add(1, 'month')] as [Moment, Moment];
  }, [props.time]);
  // Start of the view (start of the week that contains the start of month)
  const start = useMemo(() => moment(monthRange[0]).startOf('week'), [monthRange[0]]);

  // Number of weeks that need to be displayed
  const numWeeks = useMemo(() => Math.ceil(monthRange[1].diff(start, 'days') / 7), [monthRange[1], start]);
  

  // Called when event is dropped
  const onEventDrop = useCallback((e: MomentCalendarEvent, gridPos: { x: number; y: number }) => {
    // Get original event
    const origEvent = props.events.find((x) => x.id === e.id) || e;

    // Calculate new times
    const estart = moment(origEvent.start);
    const duration = origEvent.end ? moment(origEvent.end).diff(estart) : moment({ h: 1 }).unix();
    const dayOffset = estart.diff(moment(estart).startOf('day'));
    const newStart = moment(start).add(gridPos.y, 'weeks').add(gridPos.x, 'days').add(dayOffset);
    const newEnd = moment(newStart).add(duration);

    // User callback
    props.onEventChange?.(e.id, {
      start: newStart.toISOString(),
      end: newEnd.toISOString(),
    });
  }, [start, props.onEventChange]);

  // Drag drop for day events
  const dragDropDay = useDraggableGridEvents({
    scrollAreaRef: containerRef,
    timeGutter: 0,
    headerSize: props.style.monthHeaderHeight,
    rows: numWeeks,
    cols: 7,
    useYOffset: false,
    onDrop: onEventDrop,
  });

  // Drag drop for multiday events
  const dragDropMulti = useDraggableMultidayMonth({
    containerRef,
    start,
    headerSize: props.style.monthHeaderHeight,
    rows: numWeeks,
    cols: 7,
    onDrop: onEventDrop,
  });

  // Drag create events
  const dragCreate = useDragCreate({
    containerRef,
    headerSize: props.style.monthHeaderHeight,
    rows: numWeeks,
    cols: 7,
    onCreate: (startIdx, duration) => {
      props.onNewEventRequest?.(
        moment(start).add(startIdx.y, 'weeks').add(startIdx.x, 'days'),
        { duration: moment({ days: duration }) }
      );
    },
  });

  const newEventObj = dragCreate.event || dragDropMulti.event;
  const newEventRects = dragCreate.rects || dragDropMulti.rects;


  // Prefilter events that are in this month
  const events = useMemo(() => {
    // End of week
    const end = moment(start).add(numWeeks, 'week');

    return props.events.filter((e) => {
      const estart = moment(e.start);
      return estart.isBefore(end) && (e.end && moment(e.end).isAfter(start) || e.all_day && estart.isAfter(start));
    });
  }, [start, numWeeks, props.events]);


  return (
    <Flex
      ref={containerRef}
      direction='column'
      h={0}
      w='100%'
      sx={{ flexGrow: 1, position: 'relative' }}
      onMouseMove={(ev) => {
        dragDropDay.onMouseMove?.(ev);
        dragDropMulti.onMouseMove?.(ev);
        dragCreate.onMouseMove?.(ev);
      }}
    >
      <Flex w='100%' sx={{ height: props.style.monthHeaderHeight }}>
        {range(7).map((day_i) => (
          <Text
            align='center'
            weight={600}
            pt={3}
            sx={(theme) => ({
              flex: '1 1 0px',
              backgroundColor: theme.colors.dark[8],
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
          key={week_i}
          time={moment(start).add(week_i, 'week')}
          monthRange={monthRange}
          events={events}
          style={props.style}
          setDay={props.setDay}
          lastRow={week_i === 4}

          draggedId={dragDropDay.event?.id || dragDropMulti.event?.id}
          onDragStart={(ev, position, offset, multiday) => {
            if (!multiday)
              dragDropDay.onDragStart(ev, offset);
            else
              dragDropMulti.onDragStart(ev, position, offset);
          }}
          onDragCreateStart={(offsetX) => {
            dragCreate.onDragStart(week_i, offsetX)
          }}
          onClickCreate={(gridX) => {
            props.onNewEventRequest?.(
              moment(start).add(week_i, 'weeks').add(gridX, 'days'),
              { all_day: true }
            );
          }}
        />
      ))}


      {newEventObj && newEventRects?.map((rect) => (
        <Box
          sx={(theme) => ({
            position: 'absolute',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            width: rect.w,
            height: '1.625rem',
            top: `calc(${rect.y}px + 2rem)`,
            left: rect.x,
            boxShadow: `0px 0px 16px #00000030`,
            cursor: 'grab',

            padding: '0.125rem 0.4rem',
            paddingLeft: '0.75rem',
            background: rect.has_prev ?
              `color-mix(in srgb, ${newEventObj.color || props.style.colors.event} 20%, ${theme.colors.dark[7]})` :
              `linear-gradient(to right, ${newEventObj.color || props.style.colors.event} 0.25rem, color-mix(in srgb, ${newEventObj.color || props.style.colors.event} 20%, ${theme.colors.dark[7]}) 0)`,
            fontSize: theme.fontSizes.sm,
            borderTopLeftRadius: rect.has_prev ? 0 : theme.radius.sm,
            borderBottomLeftRadius: rect.has_prev ? 0 : theme.radius.sm,
            borderTopRightRadius: rect.has_next ? 0 : theme.radius.sm,
            borderBottomRightRadius: rect.has_next ? 0 : theme.radius.sm,
          })}
        >
          {newEventObj.title}
        </Box>
      ))}

      {dragDropDay.event && dragDropDay.rect && (
        <Box
          sx={(theme) => {
            assert(dragDropDay.rect);

            return {
              position: 'absolute',
              overflow: 'hidden',
              width: dragDropDay.rect.w,
              top: `calc(${dragDropDay.rect.y}px + 2rem)`,
              left: dragDropDay.rect.x,
              boxShadow: `0px 0px 16px #00000030`,
              cursor: 'grab',

              padding: '0.0625rem 0.25rem',
              background: theme.colors.dark[6],
              borderRadius: theme.radius.sm,
            };
          }}
        >
          <Group spacing={6} noWrap maw='100%'>
            <ColorSwatch color={dragDropDay.event.color || props.style.colors.event} size={14} sx={{ flexShrink: 0 }} />
            <Text weight={600} size='sm'>{moment(dragDropDay.event.start).format('LT')}</Text>
            <Text size='sm' weight={400} sx={{
              flexGrow: 1,
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>{dragDropDay.event.title}</Text>
          </Group>
        </Box>
      )}
    </Flex>
  );
}
