import { CalendarEvent } from '@/lib/types';
import moment, { Moment } from 'moment';

/** Checks if a certain repeat event occurs during a certain day */
export function hasRepeatEvent(day: Moment, event: CalendarEvent) {
	const estart = moment(event.start);

	if (event.repeat && day.isSameOrAfter(estart, 'day')) {
		if (event.repeat.interval_type === 'day')
			return day.diff(moment(estart).startOf('day'), 'days') % event.repeat.interval === 0;
		else if (event.repeat.interval_type === 'week')
			return moment(day).startOf('week').diff(moment(estart).startOf('week'), 'weeks') % event.repeat.interval === 0 && event.repeat.week_repeat_days && event.repeat.week_repeat_days.indexOf(day.day()) >= 0;
		else if (event.repeat.interval_type === 'month')
			return moment(day).startOf('month').diff(moment(estart).startOf('month'), 'months') % event.repeat.interval === 0 && day.date() === estart.date();
		else
			return moment(day).startOf('year').diff(moment(estart).startOf('year'), 'years') % event.repeat.interval === 0 && day.month() === estart.month() && day.date() === estart.date();
	}

	return false;
}