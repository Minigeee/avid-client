
/** Type for a calendar event */
export type CalendarEvent = {
	/** The id of the event */
	id: string;
	/** The id of the channel this event belongs to */
	channel: string;
	/** The title of the event */
    title: string;
	/** Optional event description */
	description?: string;
	/** The color of the event */
	color?: string;
	/** The start time of the event */
    start: string;
	/** The end time of the event */
    end?: string;
	/** Indicates if this event is an all day event */
    all_day?: boolean | undefined;
	/** THe time the event was created */
	time_created: string;

	/** Data used to define repeating event behavior */
	repeat?: {
		/** Interval between repeat events */
		interval: number;
		/** Interval type */
		interval_type: 'day' | 'week' | 'month' | 'year';
		/** The ending date of the repeat event (never if undefined) */
		end_on?: string;
		/** Days to repeat if in `week` mode, list of days of the week 0 = Sunday */
		week_repeat_days?: number[];
	};
};


/** Calendar object */
export type Calendar = {
	/** Id of the calendar */
	id: string;
	/** THe time the calendar was created */
	time_created: string;

	/** A list of calendar event ids */
	events: string[];
};