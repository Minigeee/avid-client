import useSWR, { BareFetcher } from 'swr';
import assert from 'assert';

import { FetcherOptions, fetcher } from '@/lib/db';
import { SwrMutatorFactory, SwrMutators, SwrWrapperOptions, wrapSwrData } from '@/lib/utility/swr-wrapper';

import { useSession } from './use-session';


////////////////////////////////////////////////////////////
type SwrDbQueryOptions<T, Mutators extends SwrMutators, Separate extends boolean> =
	FetcherOptions<any, T> &
	Omit<SwrWrapperOptions<T, Mutators, Separate>, 'session'> & {
		/** Custom fetcher */
		fetcher?: BareFetcher<T>;
		/** Optional fallback data */
		fallback?: T;
	};

/**
 * A hook used to retrieve database data using swr
 * 
 * @param key The key to cache the request under
 * @param builder The query string builder
 * @param options Query options
 * @returns The requested data inside a swr wrapper object
 */
export function useDbQuery<T, Mutators extends SwrMutators = {}, Separate extends boolean = false>(key: string | undefined, builder?: (key: string) => string, options?: SwrDbQueryOptions<T, Mutators, Separate>) {
	const session = useSession();

	// Make sure builder exists
	if (!options?.fetcher)
		assert(builder, 'query builder is required if custom fetcher is not provided');

	const swr = useSWR<T | null>(session.token ? key : null, options?.fetcher || fetcher(builder || (() => ''), { ...options, session }));
	return wrapSwrData<T, Mutators, Separate>({
		...swr,
		data: swr.isLoading || swr.error ? options?.fallback : swr.data,
	}, {
		mutators: options?.mutators,
		mutatorParams: options?.mutatorParams,
		seperate: options?.seperate,
		session,
	});
}