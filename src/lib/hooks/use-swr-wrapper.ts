import { KeyedMutator, SWRResponse, mutate } from 'swr';
import { SWRInfiniteResponse } from 'swr/infinite';

import { SessionState } from '@/lib/contexts';
import { Domain } from '../types';
import { useMemo } from 'react';

export type SwrMutators = Record<string, (...args: any[]) => void>;

/** An object containing swr metadata */
export type SwrObject<T> = {
  /** Indicates if data exists */
  _exists: boolean;
  /** Indicates if data is still loading */
  _loading: boolean;
  /** Contains any errors that occurred while fetching data with swr */
  _error: any;
  /** Refresh data (refetch) */
  _refresh: () => void;
};

type _Data<T, Separate extends boolean> = Separate extends true
  ? { data: T }
  : T extends any[]
    ? { data: T }
    : T extends object
      ? T
      : { data: T };
type _LoadedWrapper<
  T,
  Mutators extends SwrMutators,
  Infinite extends boolean,
  Separate extends boolean,
> = _Data<T, Separate> &
  SwrObject<T> & {
    _exists: true;
    /** A set of data mutators for this swr data */
    _mutators: Mutators;
  } & (Infinite extends true
    ? {
        /**
         * Set the total number of pages that should be loaded
         *
         * @param count The total number of pages that should be loaded
         */
        _setPageCount: (count: number) => void;
        /**
         * Loads the next `n` pages of data. This function does not run if there are no more
         * entries to load, or if more entries are already loading.
         *
         * @param n The number of new pages to load (default 1)
         */
        _next: (n?: number) => void;
      }
    : {});
type _UnloadedWrapper<T, Separate extends boolean> = Partial<
  _Data<T, Separate>
> &
  SwrObject<T> & { _exists: false };

/** A wrapper for an object returned by a swr hook */
export type SwrWrapper<
  T,
  Loaded extends boolean = false,
  Mutators extends SwrMutators = {},
  Infinite extends boolean = false,
  Separate extends boolean = false,
> =
  | _LoadedWrapper<T, Mutators, Infinite, Separate>
  | (Loaded extends true ? never : _UnloadedWrapper<T, Separate>);

/** The type signature of a mutator factory function */
export type SwrMutatorFactory<T, Mutators extends SwrMutators> = (
  mutate: KeyedMutator<T>,
  session: SessionState,
  ...args: any[]
) => Mutators;

/** Wrapper options */
export type SwrWrapperOptions<
  In,
  Out,
  Mutators extends SwrMutators = {},
  Infinite extends boolean = false,
  Separate extends boolean = false,
> = {
  /** A factory function that constructs the set of mutators for the swr object */
  transform?: (data: Infinite extends true ? In[] : In) => Out | null;
  /** A factory function that constructs the set of mutators for the swr object */
  mutators?: SwrMutatorFactory<Infinite extends true ? In[] : In, Mutators>;
  /** Any extra parameters that should be passed to the mutator factory */
  mutatorParams?: any[];
  /** Determines if swr data should be placed in a separate `data` field. If the data is an array or not an object, this is done automatically. */
  separate?: Separate;
  /** The current user session used to authorize remote mutations */
  session?: SessionState;
} & (Infinite extends true
  ? {
      /** The size of a data page */
      pageSize: number;
    }
  : {});

/**
 * Wraps a swr hook response into a more convenient object
 *
 * @param response The response object returned by a swr hook
 * @returns A wrapped object containing all data returned by a swr hoook
 */
export function useSwrWrapper<
  In,
  Mutators extends SwrMutators = {},
  Infinite extends boolean = false,
  Out = In,
  Separate extends boolean = false,
>(
  response: Infinite extends true
    ? SWRInfiniteResponse<In>
    : SWRResponse<In | null>,
  options?: SwrWrapperOptions<In, Out, Mutators, Infinite, Separate>,
): SwrWrapper<Out, false, Mutators, Infinite, Separate> {
  return useMemo(() => {
    // Wrapper behavior
    const infinite = (response as SWRInfiniteResponse).setSize !== undefined;

    // Construct base wrapper object
    const swr = {
      _loading:
        response.isLoading || (response.data === undefined && !response.error),
      _error: response.error,
      _refresh: async () => {
        await response.mutate();
      },
      _mutators:
        response.data !== undefined &&
        response.data !== null &&
        options?.mutators &&
        options?.session
          ? options?.mutators(
              response.mutate as KeyedMutator<
                Infinite extends true ? In[] : In
              >,
              options.session,
              ...(options?.mutatorParams || []),
            )
          : undefined,
      _next: infinite
        ? (n) => {
            const pageSize = (options as { pageSize: number }).pageSize;
            // @ts-ignore
            const isLoadingMore =
              response.isLoading ||
              (response.size > 0 &&
                response.data &&
                !response.data[response.size - 1]);

            // @ts-ignore
            if (
              response.data[response.data.length - 1].length >= pageSize &&
              !isLoadingMore
            )
              (response as SWRInfiniteResponse).setSize(
                ((response as SWRInfiniteResponse).size || 0) + (n || 1),
              );
          }
        : undefined,
      _setPageCount: infinite
        ? (n) => (response as SWRInfiniteResponse).setSize(n)
        : undefined,
    } as Omit<SwrObject<Out>, '_exists'> & {
      _mutators: Mutators;
      _next: (n?: number) => void;
      _setPageCount: (count: number) => void;
    };

    // Bundle data seperately
    const transformed =
      options?.transform && response.data
        ? options.transform(response.data as In & In[])
        : response.data;
    const separate =
      Array.isArray(transformed) ||
      typeof transformed !== 'object' ||
      options?.separate;
    const data = separate ? { data: transformed } : transformed || {};

    if (response.data !== undefined && response.data !== null)
      return { ...data, ...swr, _exists: true };
    else return { ...data, ...swr, _exists: false };
  }, [response.data]);
}
