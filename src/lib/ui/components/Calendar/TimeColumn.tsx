import { memo, useMemo, useRef } from 'react';

import { Box, Text } from '@mantine/core';

import { CalendarStyle, MomentCalendarEvent } from './types';
import { range } from 'lodash';
import { CalendarEvent } from '@/lib/types/calendar';
import moment, { Moment } from 'moment';


////////////////////////////////////////////////////////////
export type TimeColumnProps = {
  /** The start of the day to display events for */
  day: Moment;
  /** List of events from the calendar */
  events: CalendarEvent[];

  /** Calendar styles */
  style: CalendarStyle;

  /** The event that is currently being dragged */
  draggedId?: string | null;
  /** Called when an event is start drag */
  onDragStart?: (event: MomentCalendarEvent, offset: { x: number; y: number }) => void;
  /** Called when a column drag start */
  onDragCreateStart?: (offsetY: number) => void;
  /** Called on click create */
  onClickCreate?: (gridY: number) => void;
};

////////////////////////////////////////////////////////////
function TimeColumnImpl(props: TimeColumnProps) {
  // Defaults
  const slotHeight = props.style.slotHeight;

  // Time indicator position
  const now = moment();
  const hours = now.hours() + now.minutes() / 60;

  // Used to track if column is being clicked
  const clickedRef = useRef<boolean>(false);

  // Determines if indicator should be seen
  const showIndicator = useMemo(() => {
    const start = props.day;
    const end = moment(props.day).add(1, 'd');
    return now.isAfter(start) && now.isBefore(end);
  }, [props.day]);

  // List of events to display in this column
  const events = useMemo(() => {
    // Day range
    const start = props.day;
    const end = moment(props.day).add(1, 'd');

    // Get filtered events
    const filtered = props.events.filter((event) => {
      // Event range
      const estart = moment(event.start);
      const eend = moment(event.end);

      // Check if this event should be dsiplayed, if event starts or ends in this day
      return event.end && !event.all_day && (estart.isAfter(start) && estart.isBefore(end) || eend.isAfter(start) && eend.isBefore(end)) && eend.subtract(1, 'day').isBefore(estart);
    }).map((e) => ({
      ...e,
      start: moment(e.start),
      end: moment(e.end as string),
      left: 0,
      width: 1,
      top: 0,
      height: 0,
      has_prev: false,
      has_next: false,
    })).sort((a, b) => {
      return (a.start.unix() - b.start.unix()) || (a.end.unix() - b.end.unix()) || (b.title.length - a.title.length);
    });

    // Grid of event columns
    var columns: (typeof filtered)[] = [];
    // Tracks the last event ending
    let lastEventEnding: Moment | null = null;

    // Checks if date ranges collide
    function collides(a: { start: Moment; end: Moment }, b: { start: Moment; end: Moment }) {
      return a.start.isBefore(b.end) && a.end.isAfter(b.start);
    }

    // Expands events to take up more width
    function expandEvent(e: { start: Moment; end: Moment }, skip: number, columns: (typeof filtered)[]) {
      let colSpan = 1;

      for (let i = 0; i < columns.length; ++i) {
        if (i === skip) continue;
        const col = columns[i];

        for (var ev1 of col) {
          if (collides(ev1, e)) {
            return colSpan;
          }
        }
        colSpan++;
      }

      return colSpan;
    }

    // Packs events
    function packEvents(columns: (typeof filtered)[]) {
      const maxWidth = 1.6 / columns.length;

      for (let i = 0; i < columns.length; ++i) {
        const col = columns[i];

        for (const e of col) {
          e.width = expandEvent(e, i, columns) / columns.length;
          e.left = i / columns.length;
          e.width = Math.min(maxWidth, 1 - e.left);
        }
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

      if (!placed)
        columns.push([e]);
      if (!lastEventEnding || e.end > lastEventEnding)
        lastEventEnding = e.end;
    }

    if (columns.length > 0)
      packEvents(columns);

    // Calculate height and top
    for (const e of filtered) {
      e.has_prev = e.start.date() !== props.day.date();
      e.has_next = e.end.date() !== props.day.date();
      const start = e.has_prev ? 0 : e.start.hours() + e.start.minutes() / 60;
      const end = e.has_next ? 24 : e.end.hours() + e.end.minutes() / 60;

      e.top = start;
      e.height = end - start;
    }

    // Sort by left now to make sure left most are rendered first
    return filtered.sort((a, b) => a.left - b.left);
  }, [props.day, props.events]);


  return (
    <Box
      sx={{
        position: 'relative',
        flexGrow: 1,
      }}

      draggable
      onDragStart={(ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        const rect = ev.currentTarget.getBoundingClientRect();
        props.onDragCreateStart?.(ev.pageY - rect.y);

        // Reset
        clickedRef.current = false;
      }}

      onMouseDown={() => { clickedRef.current = true; }}
      onMouseUp={(ev) => {
        if (!clickedRef.current) return;

        const rect = ev.currentTarget.getBoundingClientRect();
        const unitY = rect.height / 24;

        props.onClickCreate?.(Math.round((ev.pageY - rect.y) / unitY * 4) / 4);

        // Reset
        clickedRef.current = false;
      }}
    >
      {range(24).map((i) => (
        <Box
          w='100%'
          h={slotHeight}
          sx={(theme) => ({
            borderBottom: `1px solid ${props.style.colors.cellBorder}`,
            borderLeft: `1px solid ${props.style.colors.cellBorder}`,
          })}
        />
      ))}

      {events.map((e, i) => (
        <Box
          sx={(theme) => ({
            position: 'absolute',
            overflow: 'hidden',
            width: (e.width * 95) + '%',
            height: `calc(${e.height} * ${slotHeight} - ${e.has_next ? '1px' : '0.25rem'})`,
            top: `calc(${e.top} * ${slotHeight})`,
            left: (e.left * 95) + '%',
            boxShadow: `0px 0px 8px #00000030`,
            opacity: props.draggedId === e.id ? 0.6 : undefined,
            cursor: 'pointer',

            padding: '0.1rem 0.4rem',
            paddingLeft: '0.75rem',
            marginBottom: '0.25rem',
            marginLeft: '0.25rem',
            background: `linear-gradient(to right, ${e.color || theme.colors.gray[6]} 0.25rem, color-mix(in srgb, ${e.color || theme.colors.gray[6]} 20%, ${theme.colors.dark[7]}) 0)`,
            fontSize: theme.fontSizes.sm,
            borderTopLeftRadius: e.has_prev ? 0 : theme.radius.sm,
            borderTopRightRadius: e.has_prev ? 0 : theme.radius.sm,
            borderBottomLeftRadius: e.has_next ? 0 : theme.radius.sm,
            borderBottomRightRadius: e.has_next ? 0 : theme.radius.sm,
          })}

          draggable
          onDragStart={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();

            const rect = ev.currentTarget.getBoundingClientRect();
            const offset = { x: ev.pageX - rect.x, y: ev.pageY - rect.y };

            // console.log('drag', offset);
            props.onDragStart?.(e, offset);
          }}
        >
          <Text color='dimmed' weight={600} size={11}>
            {e.start.format('LT')} - {e.end.format('LT')}
          </Text>
          <Text weight={600} maw='100%' sx={{
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {e.title}
          </Text>
        </Box>
      ))}

      {showIndicator && (
        <Box
          sx={(theme) => ({
            position: 'absolute',
            width: '100%',
            height: '1px',
            top: `calc(${hours} * ${slotHeight})`,
            backgroundColor: props.style.colors.timeIndicator,
          })}
        />
      )}
    </Box>
  );
}

const TimeColumn = memo(TimeColumnImpl);
export default TimeColumn;