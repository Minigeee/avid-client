
export type CalendarEvent = {
	/** The id of the event */
	id: string;
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
};