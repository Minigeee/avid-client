import { KeyedMutator, SWRResponse } from 'swr';
import { SessionState } from '@/lib/contexts';


export type SwrRefresh = () => Promise<void>;
export type SwrUpdate<T> = (data: T, revalidate?: boolean) => Promise<void>;
export type SwrMutators = Record<string, (...args: any[]) => void>;

/** An object containing swr metadata */
export type SwrObject<T> = {
	/** Indicates if data exists */
	_exists: boolean;
	/** Indicates if data is still loading */
	_loading: boolean;
	/** Contains any errors that occurred while fetching data with swr */
	_error: any;
	/** This function revalidates swr data to ensure local data is correct */
	_refresh: SwrRefresh;
	/** This function updates the value of the swr object, with an option to revalidate to ensure local data is correct */
	_update: SwrUpdate<T>;
};

/** A wrapper for an object returned by a swr hook */
export type SwrWrapper<T, Mutators extends SwrMutators = {}, Seperate extends boolean = false, Loaded extends boolean = false> =
	((Seperate extends true ? { data: T } : T) & SwrObject<T> & { _mutators: Mutators } & { _exists: true }) |
	(Loaded extends true ? never : ((Seperate extends true ? { data?: T } : Partial<T>) & SwrObject<T> & { _exists: false }));

/** The type signature of a mutator factory function */
export type SwrMutatorFactory<T, Mutators extends SwrMutators> = (mutate: KeyedMutator<T>, session: SessionState, ...args: any[]) => Mutators;

/** Wrapper options */
export type SwrWrapperOptions<T, Mutators extends SwrMutators = {}, Seperate extends boolean = false> = {
	/** A factory function that constructs the set of mutators for the swr object */
	mutators?: SwrMutatorFactory<T, Mutators>;
	/** Any extra parameters that should be passed to the mutator factory */
	mutatorParams?: any[];
	/** If the swr data should be put into a separate `data` field */
	seperate?: Seperate;
	/** The current user session used to authorize remote mutations */
	session?: SessionState;
};


/**
 * Wraps a swr hook response into a more convenient object
 * 
 * @param response The response object returned by a swr hook
 * @returns A wrapped object containing all data returned by a swr hoook
 */
export function wrapSwrData<T, Mutators extends SwrMutators = {}, Seperate extends boolean = false>
	(response: SWRResponse<T | null>, options?: SwrWrapperOptions<T, Mutators, Seperate>):
	SwrWrapper<T, Mutators, Seperate> {

	const swr = {
		_loading: response.data === undefined && !response.error,
		_error: response.error,
		_refresh: async () => { await response.mutate(); },
		_update: async (data: T | SwrWrapper<T>, revalidate: boolean = false) => {
			const { _exists, _loading, _error, _refresh, _update, _mutators, ...filtered } = data as SwrWrapper<T, {}, false, true>;
			await response.mutate(filtered as T, { revalidate });
		},
		_mutators: response.data !== undefined && response.data !== null && options?.mutators && options?.session ?
		options?.mutators(response.mutate as KeyedMutator<T>, options.session, ...(options?.mutatorParams || [])) :
			undefined,
	} as SwrObject<T> & { _mutators: Mutators };

	// Bundle data seperately
	const data = options?.seperate ? { data: response.data } : response.data || {};

	if (response.data !== undefined && response.data !== null)
		return { ...data, ...swr, _exists: true };
	else
		return { ...data, ...swr, _exists: false };
}