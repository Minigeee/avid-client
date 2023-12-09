import useSWR, { KeyedMutator, mutate as _mutate } from 'swr';
import { useEffect, useMemo } from 'react';
import assert from 'assert';

import config from '@/config';
import { api } from '@/lib/api';
import { SessionState } from '@/lib/contexts';
import { CalendarEvent } from '@/lib/types';

import { renderNativeEmojis } from '@/lib/utility/emoji';
import { swrErrorWrapper } from '@/lib/utility/error-handler';

import { SwrWrapper } from './use-swr-wrapper';

import sanitizeHtml from 'sanitize-html';
import { useApiQuery } from './use-api-query';
import { setMembers } from './use-members';

import moment, { Moment } from 'moment';


/** Cache used to keep all calendar events loaded */
const _cache: Record<string, Record<string, CalendarEvent>> = {};
/** Used to track which api requests occurred */
const _requests: Record<string, number> = {};

////////////////////////////////////////////////////////////
function _sanitize<T extends Partial<CalendarEvent>>(event: T) {
	if (event.description)
		event.description = renderNativeEmojis(sanitizeHtml(event.description, config.sanitize));

	return event;
}


////////////////////////////////////////////////////////////
function mutators(mutate: KeyedMutator<CalendarEvent[]>, session: SessionState | undefined, channel_id: string) {
	assert(session);

	return {
		/**
		 * Add a new calendar event to the calendar channel
		 * 
		 * @param event The event to add
		 * @returns The new list of calendar events
		 */
		addEvent: (event: Omit<CalendarEvent, 'id' | 'time_created'>) => mutate(
			swrErrorWrapper(async (events: CalendarEvent[]) => {
				// Create calendar event
				const results = await api('POST /calendar_events', {
					body: event
				}, { session });
				const sanitized = _sanitize(results);

				// Add to cache
				_cache[channel_id][sanitized.id] = sanitized;

				// Add to list
				return [...events, sanitized];
			}, { message: 'An error occurred while adding calendar event' }),
			{ revalidate: false }
		),

		/**
		 * Update a calendar event within the calendar channel
		 * 
		 * @param event_id The id of the event to update
		 * @param event The new event data to set
		 * @param optimistic Determines if the updated data should be applied optmistically
		 * @returns The new list of calendar events
		 */
		updateEvent: (event_id: string, event: Partial<CalendarEvent>, optimistic: boolean = false) => mutate(
			swrErrorWrapper(async (events: CalendarEvent[]) => {
				// Create calendar event
				const results = await api('PATCH /calendar_events/:event_id', {
					params: { event_id },
					body: event,
				}, { session });
				const sanitized = _sanitize(results);

				// Update cache
				_cache[channel_id][sanitized.id] = sanitized;

				// Update within list
				const copy = events.slice();
				const idx = copy.findIndex(x => x.id === event_id);
				copy[idx] = sanitized;

				// Update individual hook
				if (!optimistic)
					_mutate(event_id, (old: CalendarEvent | undefined) => ({ ...old, ...sanitized }), { revalidate: false });

				return copy;
			}, { message: 'An error occurred while modifying calendar event' }),
			{
				optimisticData: optimistic ? (events) => {
					if (!events) return [];

					// Find index
					const idx = events.findIndex(x => x.id === event_id);
					if (idx < 0) return events;

					const copy = events.slice();
					copy[idx] = _sanitize({ ...copy[idx], ...event });

					// Optimistic update for individual hook
					_mutate(event_id, (old: CalendarEvent | undefined) => ({ ...old, ...copy[idx] }), { revalidate: false });

					return copy;
				} : undefined,
				revalidate: false,
			}
		),

		/**
		 * Remove a calendar event from its calendar channel
		 * 
		 * @param event_id The id of the event to remove
		 * @returns The new events list
		 */
		removeEvent: (event_id: string) => mutate(
			swrErrorWrapper(async (events: CalendarEvent[]) => {
				// Remove from db
				await api('DELETE /calendar_events/:event_id', {
					params: { event_id },
				}, { session });

				// Remove from cache
				delete _cache[channel_id][event_id];

				// Remove from list
				return events.filter(x => x.id !== event_id);
			}, { message: 'An error occurred while removing calendar event' }),
			{
				optimisticData: (events) => {
					if (!events) return [];
					return events.filter(x => x.id !== event_id);
				},
				revalidate: false,
			}
		),
	};
}


/** Mutators that will be attached to the calendar events swr wrapper */
export type CalendarEventsMutators = ReturnType<typeof mutators>;
/** Swr data wrapper for a list of calendar events */
export type CalendarEventsWrapper<Loaded extends boolean = true> = SwrWrapper<CalendarEvent[], Loaded, CalendarEventsMutators>;

/**
 * A swr hook that performs a db query to retrieve tasks from a project board.
 * All fields are retrieved except `description`, `board`, `time_updated`, and `time_status_changed`.
 * 
 * @param board_id The id of the board to retrieve tasks from
 * @param domain_id The id of the domain the board belongs to, used to fetch and cache assignees
 * @returns A swr object containing the requested tasks
 */
export function useCalendarEvents(channel_id: string | undefined, date: Moment) {
	// Used to calculate date range to fetch (batch events)
	const range = useMemo(() => {
		return [moment(date).startOf('year').subtract(1, 'month'), moment(date).endOf('year').add(1, 'month')];
	}, [date]);

	// Wrapper hook
	const wrapper = useApiQuery(channel_id ? `${channel_id}.calendar_events` : undefined, 'GET /calendar_events', {
		query: {
			channel: channel_id || '',
			from: range[0].toDate(),
			to: range[1].toDate(),
		},
	}, {
		then: (events) => {
			assert(channel_id);

			// Add all events to cache
			if (!_cache[channel_id])
				_cache[channel_id] = {};
			for (const ev of events)
				_cache[channel_id][ev.id] = _sanitize(ev);

			// Remove events that were deleted (bc of cache, will need extra logic to detect which ones were deleted)
			const idSet = new Set<string>(events.map(x => x.id));

			const deleted: string[] = [];
			for (const ev of Object.values(_cache[channel_id])) {
				if (!idSet.has(ev.id) && (moment(ev.start).isAfter(range[0]) && ev.end && moment(ev.end).isBefore(range[1])))
					deleted.push(ev.id);
			}

			for (const id of deleted)
				delete _cache[channel_id][id];

			// Record time
			const key = `${channel_id}-${range[0].toISOString()}-${range[1].toISOString()}`;
			_requests[key] = Date.now();

			// Return all events
			return Object.values(_cache[channel_id]);
		},
		mutators,
		mutatorParams: [channel_id],
	});

	// Refresh when range changes
	useEffect(() => {
		if (!channel_id) return;

		// Request key
		const key = `${channel_id}-${range[0].toISOString()}-${range[1].toISOString()}`;

		// Check if this is first channel call, if it is skip to avoid double api call
		if (!_requests[key]) {
			const keys = Object.keys(_requests);
			const idx = keys.findIndex(k => k.startsWith(channel_id));
			if (idx < 0)
				// First call, skip
				return;
		}

		// Calculate time since last request
		const dt = Date.now() - (_requests[key] || 0);

		// Refresh if past dedupe interval
		if (dt / 1000 > config.swr.dedupe_interval)
			wrapper._refresh();
	}, [range[0].toISOString()]);

	return wrapper;
}


/** Swr data wrapper for a domain object */
export type CalendarEventWrapper<Loaded extends boolean = true> = SwrWrapper<CalendarEvent, Loaded>;

/** Map of individual events that were loaded (channel id to events list), used to track which events need to be reloaded on calendar change event (descriptions won't update properly) */
const _singleEvents: Record<string, Set<string>> = {};

/**
 * A swr hook that performs a db to retrieve a task.
 * 
 * @param task_id The id of the task to retrieve
 * @param fallback The optional fallback task data to display while task is loading or errored
 * @returns A swr object containing the requested task
 */
export function useCalendarEvent(event_id: string | undefined, fallback?: CalendarEvent) {
	return useApiQuery(event_id, 'GET /calendar_events/:event_id', {
		params: { event_id: event_id || '' },
	}, {
		then: (results) => {
			assert(results);

			if (!_singleEvents[results.channel])
				_singleEvents[results.channel] = new Set<string>();
			_singleEvents[results.channel].add(results.id);

			return _sanitize(results);
		},
		fallback,
	})
}


/** Get the set of events that have been loaded indivudually for a certain calendar channel */
export function getLoadedSingleEvents(board_id: string): Set<string> | null {
	return _singleEvents[board_id] || null;
}