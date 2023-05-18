import useSWR, { BareFetcher } from 'swr';
import assert from 'assert';

import { SessionState } from '@/lib/contexts';
import { FetcherOptions, fetcher } from '@/lib/db';

import { SwrMutatorFactory, SwrMutators, SwrWrapperOptions, useSwrWrapper } from './use-swr-wrapper';
import { useSession } from './use-session';
type _DefaultFetcher = {
	/** Query string builder for the default fetcher */
	builder: (key: string) => string;
};
type _CustomFetcher<T> = {
	/** Custom fetcher. If a custom fetcher is used, then `options.then` will not be executed. */
	fetcher: (session: SessionState) => BareFetcher<T>;
};

////////////////////////////////////////////////////////////
type SwrDbQueryOptions<In, Out, Mutators extends SwrMutators> =
	FetcherOptions<any, Out> &
	Omit<SwrWrapperOptions<In, Out, Mutators>, 'session'> &
	(_DefaultFetcher | _CustomFetcher<In>) & {
		/** Optional fallback data. This should be data that a fetcher would return (pre-transform function) */
		fallback?: In;
	};

/**
 * A hook used to retrieve database data using swr.
 * This hook is an abstraction of swr-wrapper for surrealdb queries
 * and does not support useSWRInfinite.
 * 
 * @param key The key to cache the request under
 * @param builder The query string builder
 * @param options Query options
 * @returns The requested data inside a swr wrapper object
 */
export function useDbQuery<In, Mutators extends SwrMutators = {}, Out = In>(key: string | undefined, options: SwrDbQueryOptions<In, Out, Mutators>) {
	const session = useSession();

	// Swr hook
	const swr = useSWR<In | null>(
		session.token ? key : null,
		(options as _CustomFetcher<In>).fetcher?.(session) || fetcher((options as _DefaultFetcher).builder || (() => ''), { ...options, session })
	);

	// Swr wrapper
	return useSwrWrapper<In, Mutators, false, Out>({
		...swr,
		data: swr.isLoading || swr.error ? options.fallback : swr.data,
	}, {
		transform: options.transform,
		mutators: options.mutators,
		mutatorParams: options.mutatorParams,
		session,
	});
}