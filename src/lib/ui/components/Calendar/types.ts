
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

	/** The size of the time label gutter */
	timeGutter: string;
	/** The time slot height for week and day views */
	slotHeight: string;
};