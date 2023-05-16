import { useContext } from 'react';
import assert from 'assert';

import { StorageContext } from '@/lib/contexts/storage';


/**
 * Get storage container. A storage container is a mutable data container
 * that does not follow typical React conventions, so it should only be used
 * as a cache or for data that will not be rendered. All data stored within
 * this container will be accessible from other components.
 * 
 * A storage container does not work well with functions that are not hooks or components
 * because there is no way to access the context from those functions. For example,
 * the member db functions must rely on local file variables to store cache data because
 * those functions are accessed from parts of the code (i.e. the rich text editor) that don't have
 * access to hooks.
 * 
 * @param key The key of the storage container to get
 * @param defaultValue The value that should be assigned to the storage container if it does not exist.
 * 		This value is optional, but an error will be thrown if it is not provided when the storage container does not exist.
 * @returns A storage container associated with the given key
 */
export function useStorage<T>(key: string, defaultValue?: T): T {
	const storage = useContext(StorageContext);
	if (storage[key] === undefined) {
		assert(defaultValue !== undefined);
		storage[key] = defaultValue;
	}

	return storage[key];
}