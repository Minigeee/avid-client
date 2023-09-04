import { CalendarEvent } from '@/lib/types';
import { Moment } from 'moment';


export type CalendarStyle = {
	/** Calendar colors */
	colors: {
		/** Default event color */
		event: string;
		/** Color of time indicator line in week and day view */
		timeIndicator: string;
		/** The color of cell borders */
		cellBorder: string;
	};

	/** The size of the time label gutter (px) */
	timeGutter: number;
	/** The time slot height for week and day views */
	slotHeight: string;
	/** The size of the month header (px) */
	monthHeaderHeight: number;
};

export type MomentCalendarEvent = Omit<CalendarEvent, 'start' | 'end'> & {
	start: Moment;
	end?: Moment;
};