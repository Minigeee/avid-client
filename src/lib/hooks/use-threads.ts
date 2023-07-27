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
import { makeMarkdownEnv, renderMessage } from './use-messages';


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
			return results.map(t => ({ ...t, name: renderMessage(t.name, env).replace(/<\/?[^>]+(>|$)/g, ' ').replace(/<[^>]+>/g, '') }));
		},
		mutators,
	});
}