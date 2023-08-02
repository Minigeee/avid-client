import { useMemo } from 'react';
import assert from 'assert';

import useSWR, { KeyedMutator, mutate as _mutate } from 'swr';

import config from '@/config';
import { api } from '@/lib/api';
import { SessionState } from '@/lib/contexts';
import { Thread } from '@/lib/types';

import { useApiQuery } from './use-api-query';
import { DomainWrapper } from './use-domain';
import { SwrWrapper, useSwrWrapper } from './use-swr-wrapper';

import { swrErrorWrapper } from '@/lib/utility/error-handler';
import { makeExternalStore } from '@/lib/utility/external-store';
import { makeMarkdownEnv, renderMessage } from './use-messages';
import { useSession } from './use-session';


/** Cache for threads */
const _ = {
	store: {} as Record<string, Thread>,
};

const { useExternalStore, emit: emitChange } = makeExternalStore('threads', _);


/** Mutators */
function mutators(mutate: KeyedMutator<Thread[]>, session: SessionState) {
	return {
		/**
		 * Set the name of a thread
		 * 
		 * @param thread_id The id of the thread to set the name of
		 * @param name The new name to give the thread
		 * @returns The new list of threads
		 */
		setName: (thread_id: string, name: string) => mutate(
			swrErrorWrapper(async (threads: Thread[]) => {
				// Change thread name
				const results = await api('PATCH /threads/:thread_id', {
					params: { thread_id },
					body: { name },
				}, { session });

				const idx = threads.findIndex(x => x.id === thread_id);
				if (idx < 0) return threads;

				const copy = threads.slice();
				copy[idx] = results;

				// Update thread
				setThreads([copy[idx]]);

				return copy;
			}, { message: 'An error occurred while changing thread name' }),
			{
				revalidate: false,
				optimisticData: (threads) => {
					if (!threads) return [];

					const idx = threads.findIndex(x => x.id === thread_id);
					if (idx < 0) return threads;
	
					const copy = threads.slice();
					copy[idx] = { ...copy[idx], name };
	
					return copy;
				},
			}
		),
	};
}

/** Mutators that will be attached to the threads swr wrapper */
export type ThreadsMutators = ReturnType<typeof mutators>;
/** Swr data wrapper for threads */
export type ThreadsWrapper<Loaded extends boolean = true> = SwrWrapper<Thread[], Loaded, ThreadsMutators>;
/** Swr data wrapper for threads without mutators */
export type ThreadsWrapperNoMutators<Loaded extends boolean = true> = ({ _exists: true; data: Thread[] }) | (Loaded extends true ? never : { _exists: false; data?: Thread[] });


/**
 * Retrieve threads for the specified channel.
 * 
 * @param channel_id The id of the channel to retrieve threads from
 * @param domain The domain the channel belongs to (used to render thread names, as they are often message contents)
 * @returns A list of threads sorted lastest activity first
 */
export function useThreads(channel_id: string, domain: DomainWrapper) {
	return useApiQuery(channel_id ? `${channel_id}.threads` : undefined, 'GET /threads', {
		query: {
			channel: channel_id,
			limit: config.app.thread.query_limit,
		},
	}, {
		then: (results) => {
			const env = makeMarkdownEnv(domain);
			const threads = results.map(t => ({ ...t, name: renderMessage(t.name, env).replace(/<\/?[^>]+(>|$)/g, ' ').replace(/<[^>]+>/g, '') }));

			setThreads(threads);
			return threads;
		},
		mutators,
	});
}


/** Set threads to store */
export function setThreads(threads: Thread[], emit: boolean = true) {
	if (threads.length === 0) return;

	const copy = { ..._.store };
	for (const t of threads)
		copy[t.id] = t;

	_.store = copy;

	if (emit)
		emitChange();
}


/**
 * Retrieve threads for the specified channel.
 * 
 * @param channel_id The id of the channel to retrieve threads from
 * @param ids The list of thread ids to retrieve
 * @param domain The domain the channel belongs to (used to render thread names, as they are often message contents)
 * @returns A list of threads sorted lastest activity first
 */
export function useThreadsById(channel_id: string, ids: string[], domain: DomainWrapper) {
	const session = useSession();
	const cache = useExternalStore();

	return useMemo(() => {
		// Make a list of which threads need to be retrieved
		const threads: Thread[] = [];
		const needFetch: string[] = [];

		for (const id of ids) {
			const cached = _.store[id];
			if (!cached)
				needFetch.push(id);
			else
				threads.push(cached);
		}
	
		// Fetch these ids
		if (needFetch.length > 0) {
			api('GET /threads', {
				query: {
					channel: channel_id,
					ids: ids,
				},
			}, { session })
				.then((results) => {
					// Render thread names
					const env = makeMarkdownEnv(domain);
					const threads = results.map(t => ({ ...t, name: renderMessage(t.name, env).replace(/<\/?[^>]+(>|$)/g, ' ').replace(/<[^>]+>/g, '') }));

					setThreads(threads);
				});
		}
		
		return {
			_exists: threads.length > 0,
			data: threads,
		} as ThreadsWrapperNoMutators<false>;
	}, [cache]);
}


/**
 * Get thread cache. Should be used in a component for it to recieve thread cache changes.
 * 
 * @returns Thread cache
 */
export function useThreadCache() {
	return useExternalStore();
}


/**
 * Get a thread from cache
 * 
 * @param thread_id The id of the thread to get
 * @returns The thread object or null if it doesn't exist
 */
export function getThreadSync(thread_id: string): Thread | null {
	return _.store[thread_id] || null;
}