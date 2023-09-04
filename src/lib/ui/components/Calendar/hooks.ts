import { MouseEventHandler, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MomentCalendarEvent } from './types';
import moment, { Moment } from 'moment';


////////////////////////////////////////////////////////////
export type UseDraggableEventsProps = {
	/** Used to calculate grid, and to scroll up and down for drag events */
	scrollAreaRef: RefObject<HTMLDivElement>;
	/** Size of time gutter (px) */
	timeGutter: number;
	/** Header size (px) */
	headerSize?: number;
	/** Number of rows in grid (default 4) */
	rows: number;
	/** Number of columns to include in grid (default 7) */
	cols?: number;
	/** Number of hour cell subdivisions. Assigning a value to this will force event height to be event duration */
	subdivisions?: number;
	/** Should the mouse y offset be maintained (default true) */
	useYOffset?: boolean;

	/** Called when event is dropped */
	onDrop?: (e: MomentCalendarEvent, gridPos: { x: number; y: number }) => void;
};

////////////////////////////////////////////////////////////
export function useDraggableGridEvents(props: UseDraggableEventsProps) {
	// Event being dragged
	const [draggedEvent, setDraggedEvent] = useState<MomentCalendarEvent | null>(null);
	// Drag offset
	const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
	// Dragged position
	const [eventRect, setEventRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

	// Tracks current dragged event's grid position
	const gridPos = useRef<{ x: number; y: number } | null>(null);


	// Called on event drag start
	const onDragStart = useCallback((e: MomentCalendarEvent, offset: { x: number; y: number }) => {
		setDraggedEvent(e);
		setOffset(offset);
	}, []);

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
			const top = e.clientY - rect.y + scrollArea.scrollTop - (useYOffset ? offset.y : 0);

			// Snap to grid
			const unitX = (scrollArea.clientWidth - props.timeGutter) / cols;
			const unitY = (scrollArea.scrollHeight - header) / rows;
			const gridX = Math.max(0, Math.min(Math.floor((left - props.timeGutter) / unitX), cols - 1));
			const gridY = Math.max(0, Math.min(Math.floor((top - header) / unitY), rows - 1));
			const snapped = {
				x: gridX * unitX + props.timeGutter,
				y: gridY * unitY + header,
			};

			if (!eventRect || snapped.x != eventRect.x || snapped.y != eventRect.y) {
				let h = 1;

				if (subdivs > 0) {
					const duration = draggedEvent.end ? draggedEvent.end.diff(draggedEvent.start) : moment({ h: 1 }).unix();
					const newStart = moment({ h: gridY / subdivs, m: 60 * (gridY % subdivs) / subdivs });
					const newEnd = moment(newStart).add(duration);

					const startH = newStart.hours() + newStart.minutes() / 60;
					const endH = newEnd.hours() + newEnd.minutes() / 60;

					h = endH > startH ? (endH - startH) * scrollArea.scrollHeight / 24 : scrollArea.scrollHeight - snapped.y;
				}

				// Set event rect
				setEventRect({
					x: snapped.x,
					y: snapped.y,
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
				props.onDrop?.(draggedEvent, { x: gridPos.current.x, y: gridPos.current.y / subdivs });
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
	};
}