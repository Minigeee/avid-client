import { CalendarEvent } from '@/lib/types';
import assert from 'assert';
import moment, { Moment } from 'moment';

/** Checks if a certain repeat event occurs during a certain day */
export function hasRepeatEvent(day: Moment, event: CalendarEvent) {
  const estart = moment(event.start);
  const eend = event.end ? moment(event.end) : moment(event.start).endOf('day');

  // List of time points to check
  const times = [estart];
  if (estart.dayOfYear() !== eend.dayOfYear()) times.push(eend);

  if (
    event.repeat &&
    day.isSameOrAfter(estart, 'day') &&
    (!event.repeat.end_on || day.isSameOrBefore(event.repeat.end_on))
  ) {
    // Repeat info
    const { interval, interval_type } = event.repeat;

    let contains = false;
    let numCheck = 0;

    for (const t of times) {
      // Diff in terms of interval type
      let diff =
        moment(day)
          .startOf(interval_type)
          .diff(moment(t).startOf(interval_type), interval_type) % interval;

      if (event.repeat.interval_type === 'day') contains = diff === 0;
      else if (event.repeat.interval_type === 'week')
        contains =
          diff === 0 &&
          event.repeat.week_repeat_days !== undefined &&
          event.repeat.week_repeat_days.indexOf(day.day()) >= 0;
      else if (event.repeat.interval_type === 'month')
        contains = diff === 0 && day.date() === t.date();
      else
        contains =
          diff === 0 && day.month() === t.month() && day.date() === t.date();

      if (contains) break;
      numCheck += 1;
    }

    // Check if this event is overridden
    if (contains) {
      const startDayBefore = times.length === 2 && numCheck > 0;
      const start = moment(day).subtract(startDayBefore ? 1 : 0, 'days');

      // Return true if not overridden
      return (
        !event.repeat.overrides ||
        event.repeat.overrides.findIndex((x) =>
          moment(x).isSame(start, 'day'),
        ) < 0
      );
    }
  }

  return false;
}

/**
 * Get a list of all instances of a repeat event within a week
 *
 * @param start The start of the time range to check
 * @param event The repeat event to create more of
 * @param mode The range mode to use
 */
export function getAllRepeatEvents(
  start: Moment,
  event: CalendarEvent,
  mode: 'week' | 'day' = 'week',
) {
  if (!event.repeat) return [];
  // console.log(event)
  assert(event.repeat.interval && event.repeat.interval >= 1);

  // Times
  const estart = moment(event.start).startOf('day');
  const eend = event.end ? moment(event.end) : moment(event.start).endOf('day');
  const rangeEnd = moment(start).endOf(mode);

  // Repeat info
  const { interval, interval_type } = event.repeat;

  // Duration of event in days
  const eduration = Math.ceil(eend.diff(estart, 'days'));
  if (estart.isAfter(rangeEnd)) return [];

  // Adjust start time back by duration of event
  start = moment(start).startOf(mode).subtract(eduration, 'days');

  // Find first event
  let diff =
    moment(start)
      .startOf(interval_type)
      .diff(moment(estart).startOf(interval_type), interval_type) % interval;
  if (diff < 0) diff += interval;
  let currTime = moment(start)
    .startOf(interval_type)
    .add(diff === 0 ? 0 : interval - diff, interval_type);
  // console.log(start.toISOString(), diff, currTime.toISOString())

  // Range values
  const latestStart = start.isBefore(estart) ? estart : start;
  const earliestEnd =
    event.repeat.end_on && rangeEnd.isAfter(event.repeat.end_on)
      ? moment(event.repeat.end_on)
      : rangeEnd;

  // Function for adding event
  const events: (Omit<CalendarEvent, 'start' | 'end'> & {
    start: Moment;
    end: Moment;
  })[] = [];
  const addEvent = (time: Moment) => {
    if (
      time.isBefore(latestStart) ||
      time.isAfter(earliestEnd) ||
      (event.repeat?.overrides &&
        event.repeat.overrides.findIndex((x) =>
          moment(x).isSame(time, 'day'),
        ) >= 0)
    )
      return;

    events.push({
      ...event,
      start: moment(time),
      end: moment(time).add(eduration, 'days').endOf('day'),
    });
  };

  // Add events
  while (currTime.isBefore(rangeEnd)) {
    if (event.repeat.interval_type === 'day') addEvent(currTime);
    else if (
      event.repeat.interval_type === 'week' &&
      event.repeat.week_repeat_days
    ) {
      for (const d of event.repeat.week_repeat_days)
        addEvent(moment(currTime).day(d));
    } else if (event.repeat.interval_type === 'month')
      addEvent(moment(currTime).date(estart.date()));
    else addEvent(moment(currTime).month(estart.month()).date(estart.date()));

    currTime.add(interval || 1, interval_type);
  }

  // console.log(event, events.map((ev) => ({ start: ev.start.toISOString(), end: ev.end.toISOString() })))

  return events;
}
