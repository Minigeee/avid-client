import {
  DragEventHandler,
  MouseEventHandler,
  RefObject,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { CalendarState, MomentCalendarEvent } from './types';

import moment, { Moment } from 'moment';

/** Calendar context */
// @ts-ignore
export const CalendarContext = createContext<CalendarState>();

/** Get calendar context */
export function useCalendarContext() {
  return useContext(CalendarContext);
}

////////////////////////////////////////////////////////////
export type UseDraggableEventsProps = {
  /** Used to calculate grid, and to scroll up and down for drag events */
  scrollAreaRef: RefObject<HTMLDivElement>;
  /** Size of time gutter (px) */
  timeGutter: number;
  /** Header size (px) */
  headerSize?: number;
  /** Number of rows in grid */
  rows: number;
  /** Number of columns to include in grid (default 7) */
  cols?: number;
  /** Number of hour cell subdivisions. Assigning a value to this will force event height to be event duration */
  subdivisions?: number;
  /** Should the mouse y offset be maintained (default true) */
  useYOffset?: boolean;

  /** Called when event is dropped */
  onDrop?: (
    e: MomentCalendarEvent,
    gridPos: { x: number; y: number },
    resizing: boolean,
  ) => void;
};

////////////////////////////////////////////////////////////
export function useDraggableGridEvents(props: UseDraggableEventsProps) {
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
    y: number;
    w: number;
    h: number;
  } | null>(null);
  // Event being dragged
  const [resizing, setResizing] = useState<boolean>(false);

  // Tracks current dragged event's grid position
  const gridPos = useRef<{ x: number; y: number } | null>(null);

  // Called on event drag start
  const onDragStart = useCallback(
    (
      e: MomentCalendarEvent,
      offset: { x: number; y: number },
      resize?: boolean,
    ) => {
      setDraggedEvent(e);
      setOffset(offset);
      setResizing(resize || false);
    },
    [],
  );

  // Called on mouse move (only when event being dragged)
  const onMouseMove = useMemo(() => {
    const scrollArea = props.scrollAreaRef.current;
    if (!draggedEvent || !scrollArea) return undefined;

    const rows = props.rows || 24 * 4;
    const cols = props.cols || 7;
    const subdivs = props.subdivisions || 0;
    const header = props.headerSize || 0;
    const useYOffset = props.useYOffset === false ? false : true;

    return ((e) => {
      // Calculate position relative to scroll area
      const rect = scrollArea.getBoundingClientRect();
      const left = e.clientX - rect.x;
      const top =
        e.clientY -
        rect.y +
        scrollArea.scrollTop -
        (useYOffset && !resizing ? offset.y : 0);

      // Snap to grid
      const unitX = (scrollArea.clientWidth - props.timeGutter) / cols;
      const unitY = (scrollArea.scrollHeight - header) / rows;
      const gridX = resizing
        ? draggedEvent.start.day()
        : Math.max(
            0,
            Math.min(Math.floor((left - props.timeGutter) / unitX), cols - 1),
          );
      const gridY = Math.max(
        0,
        Math.min(
          Math[resizing ? 'round' : 'floor']((top - header) / unitY),
          rows - 1,
        ),
      );
      const snapped = {
        x: gridX * unitX + props.timeGutter,
        y: gridY * unitY + header,
      };

      if (!eventRect || snapped.x != eventRect.x || snapped.y != eventRect.y) {
        let y = snapped.y,
          h = 1;

        if (resizing) {
          const startH =
            draggedEvent.start.hours() + draggedEvent.start.minutes() / 60;
          y = startH * subdivs * unitY + header;
          h = Math.abs(snapped.y - y);
          y = Math.min(y, snapped.y);
        } else if (subdivs > 0) {
          const duration = draggedEvent.end
            ? draggedEvent.end.diff(draggedEvent.start)
            : moment({ h: 1 }).unix();
          const newStart = moment({
            h: gridY / subdivs,
            m: (60 * (gridY % subdivs)) / subdivs,
          });
          const newEnd = moment(newStart).add(duration);

          const startH = newStart.hours() + newStart.minutes() / 60;
          const endH = newEnd.hours() + newEnd.minutes() / 60;

          h =
            endH > startH
              ? ((endH - startH) * scrollArea.scrollHeight) / 24
              : scrollArea.scrollHeight - snapped.y;
        }

        // Set event rect
        setEventRect({
          x: snapped.x,
          y,
          w: unitX,
          h,
        });

        // Update grid pos
        gridPos.current = { x: gridX, y: gridY };
      }
    }) as MouseEventHandler<HTMLDivElement>;
  }, [draggedEvent, eventRect]);

  // Called on mouse up event
  useEffect(() => {
    function onMouseUp() {
      // Callback
      if (draggedEvent && gridPos.current) {
        const subdivs = props.subdivisions || 1;
        props.onDrop?.(
          draggedEvent,
          { x: gridPos.current.x, y: gridPos.current.y / subdivs },
          resizing,
        );
      }

      setDraggedEvent(null);
      setEventRect(null);
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
    rect: eventRect,
    gridPos: gridPos.current,
    resizing,
  };
}

////////////////////////////////////////////////////////////
export type UseDragCreateProps = {
  /** Used to calculate grid */
  containerRef: RefObject<HTMLDivElement>;
  /** Size of time gutter (px) */
  timeGutter: number;
  /** Number of rows in grid (including subdivisions) */
  rows: number;
  /** Number of cols in grid */
  cols: number;
  /** Number of hour cell subdivisions. Assigning a value to this will force event height to be event duration */
  subdivisions?: number;

  /** Called when mouse let go */
  onCreate?: (start: { x: number; y: number }, duration: number) => void;
};

////////////////////////////////////////////////////////////
export function useDragCreate(props: UseDragCreateProps) {
  const [colIdx, setColIdx] = useState<number | null>(null);
  // Starting y pos in grid coords
  const [startY, setStartY] = useState<number | null>(null);
  const [newEvent, setNewEvent] = useState<MomentCalendarEvent | null>(null);
  // Dragged position
  const [eventRect, setEventRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  // Tracks current dragged event's grid position
  const gridPos = useRef<{ x: number; y: number; duration: number } | null>(
    null,
  );

  // Called when drag starts in column
  const onDragStart = useCallback((colIdx: number, offsetY: number) => {
    // Snap start y to grid
    let gridY = 0;

    const container = props.containerRef.current;
    if (container) {
      const unitY = container.scrollHeight / props.rows;
      gridY = Math.max(
        0,
        Math.min(Math.round(offsetY / unitY), props.rows - 1),
      );
    }

    setColIdx(colIdx);
    setStartY(gridY);
  }, []);

  // Called on mouse move (only when col being dragged)
  const onMouseMove = useMemo(() => {
    const container = props.containerRef.current;
    if (colIdx === null || !container || startY === null || colIdx === null)
      return undefined;

    const rows = props.rows || 24 * 4;
    const cols = props.cols || 7;
    const subdivs = props.subdivisions || 1;

    return ((e) => {
      // Calculate position relative to scroll area
      const rect = container.getBoundingClientRect();
      const top = e.clientY - rect.y + container.scrollTop;

      // Snap to grid
      const unitY = container.scrollHeight / rows;
      const gridY = Math.max(0, Math.min(Math.round(top / unitY), rows - 1));

      const start = Math.min(startY, gridY);
      const end = Math.max(startY, gridY, start + 1);
      const duration = (end - start) / subdivs;

      if (!eventRect || gridPos.current?.duration !== duration) {
        const newStart = moment({
          h: start / subdivs,
          m: (60 * (start % subdivs)) / subdivs,
        });
        const newEnd = moment(newStart).add(duration, 'hours');

        const colWidth = (rect.width - props.timeGutter) / cols;

        // Set event rect
        setEventRect({
          x: colIdx * colWidth + props.timeGutter,
          y: start * unitY,
          w: colWidth,
          h: duration * subdivs * unitY,
        });

        // Set temp event
        setNewEvent({
          id: '__temp__',
          channel: '',
          title: 'New Event',
          start: newStart,
          end: newEnd,
          time_created: '',
        });

        // Update grid pos
        gridPos.current = { x: colIdx, y: start, duration };
      }
    }) as MouseEventHandler<HTMLDivElement>;
  }, [colIdx, eventRect]);

  // Called on mouse up event
  useEffect(() => {
    function onMouseUp() {
      // Callback
      if (colIdx !== null && gridPos.current) {
        const subdivs = props.subdivisions || 1;
        props.onCreate?.(
          { x: gridPos.current.x, y: gridPos.current.y / subdivs },
          gridPos.current.duration,
        );
      }

      setNewEvent(null);
      setEventRect(null);
      setColIdx(null);
      setStartY(null);
      gridPos.current = null;
    }

    if (colIdx !== null) {
      window.addEventListener('mouseup', onMouseUp);

      return () => {
        window.removeEventListener('mouseup', onMouseUp);
      };
    }
  }, [colIdx]);

  return {
    onDragStart,
    onMouseMove,
    event: newEvent,
    rect: eventRect,
  };
}
