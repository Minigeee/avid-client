import useSWR, { BareFetcher } from 'swr';
import assert from 'assert';

import { ApiPath, ApiReturn } from '@/lib/types';
import { ApiReqParams, api } from '@/lib/api';
import { SessionState } from '@/lib/contexts';

import { SwrMutatorFactory, SwrMutators, SwrWrapperOptions, useSwrWrapper } from './use-swr-wrapper';
import { useSession } from './use-session';


////////////////////////////////////////////////////////////
type SwrApiQueryOptions<Path extends ApiPath, In, Out, Mutators extends SwrMutators> =
	Omit<SwrWrapperOptions<In, Out, Mutators>, 'session'> & {
		/** Optional function that gets called on the result of the api fetcher, before being passed to swr */
		then?: (results: ApiReturn<Path>) => In,
		/** Optional initial data. If this is provided, the api fetch function will not be invoked initially */
		initial?: ApiReturn<Path>;
		/** Optional fallback data. This should be data that a fetcher would return (pre-transform function) */
		fallback?: In;
		/** Swr config */
		config?: Parameters<typeof useSWR<In | null>>[2];
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
export function useApiQuery<Path extends ApiPath, In = ApiReturn<Path>, Mutators extends SwrMutators = {}, Out = In>(key: string | undefined, path: Path, params: ApiReqParams<Path>, options: SwrApiQueryOptions<Path, In, Out, Mutators>) {
	const session = useSession();

	// Swr hook
	const swr = useSWR<In | null>(
		session.token ? key : null,
		() => {
			const promise = options.initial ? new Promise<ApiReturn<Path>>((resolve) => { resolve(options.initial as ApiReturn<Path>); }) : api(path, params, { session });
			return options.then ? promise.then(options.then) : promise;
		},
		options.config
	);

	// Swr wrapper
	return useSwrWrapper<In, Mutators, false, Out>({
		...swr,
		data: !key || swr.isLoading || swr.error ? options.fallback : swr.data,
	}, {
		...options,
		session,
	});
}