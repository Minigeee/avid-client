import assert from 'assert';
import config from '@/config';


////////////////////////////////////////////////////////////
type CacheObject<T> = {
	data: T;
	last_updated: number;
}

////////////////////////////////////////////////////////////
export class MemoryCache<T> {
	_data: Record<string, CacheObject<T>>;
	_last_cleanup: number;

	/** The fetcher function used to get data that will be cached */
	fetch: (keys: string[]) => Promise<T[]>;
	/** The time (ms) after which data will be invalidated */
	invalidate_time: number;


	////////////////////////////////////////////////////////////
	constructor(fetch: (keys: string[]) => Promise<T[]>, invalidate_time: number = 10 * 60) {
		this.fetch = fetch;
		this.invalidate_time = invalidate_time * 1000;

		this._data = {};
		this._last_cleanup = Date.now();
	}


	////////////////////////////////////////////////////////////
	async _clean() {
		const now = Date.now();

		const invalid: string[] = [];
		for (const [key, data] of Object.entries(this._data)) {
			if (now - data.last_updated > this.invalidate_time)
				invalid.push(key);
		}

		// Delete all invalids
		for (const key of invalid)
			delete this._data[key];

		// Update time
		this._last_cleanup = now;
	}


	/**
	 * Store new data in the cache, overriding any existing data. The
	 * lifetime of the data is reset if it existed in the cache before.
	 * 
	 * @param key The key or list of keys to store the data under
	 * @param data The data object or list of objects to store in cache
	 */
	add(key: string | string[], data: T | T[]) {			
		const now = Date.now();

		// Clean if needed
		if (now - this._last_cleanup > 2 * this.invalidate_time)
			this._clean();

		// Add data to cache
		if (Array.isArray(key)) {
			assert(Array.isArray(data) && data.length === key.length);

			for (let i = 0; i < key.length; ++i) {
				const k = key[i];
				
				// Make new cache objects
				this._data[k] = {
					data: data[i],
					last_updated: now,
				};
			}
		}

		else {
			// Make new cache object
			this._data[key] = {
				data: data as T,
				last_updated: now,
			};
		}
	}


	/**
	 * The cache is first checked to see if a valid version of the requested
	 * object is available. If not, then `fetch()` is used to obtain a valid
	 * object and the data is cached and returned.
	 * 
	 * @param key The key or list of keys of the cached object(s) to retrieve
	 * @returns The requested object(s)
	 */
	async get<K extends string | string[]>(key: K, revalidate: boolean = false): Promise<K extends ReadonlyArray<infer A> ? T[] : T> {
		let keys: string[];
		if (!Array.isArray(key))
			keys = [key];
		else
			keys = key;
			
		// Time to measure validness
		let now = Date.now();

		// Create list of cached data
		const cached: CacheObject<T>[] = [];
		const missing: [string, number][] = [];
		for (let i = 0; i < keys.length; ++i) {
			const k = keys[i];
			const object = this._data[k];
			
			// Mark this object as missing if it is not valid
			const elapsed = now - object.last_updated;
			if (!cached || elapsed > this.invalidate_time || (revalidate && elapsed > 1 * 60))
				missing.push([k, i]);

			// Add data to list
			cached.push(object);
		}

		// Fetch data if needed
		if (missing.length > 0) {
			const newData = await this.fetch(missing.map(x => x[0]));
			
			// Update now in case fetch took a long time
			now = Date.now();
			
			// Apply new data to cached objects
			for (let i = 0; i < missing.length; ++i) {
				const idx = missing[i][1];

				// Some cache object may be null
				if (!cached[idx]) {
					// Add to cache
					const k = missing[i][0];
					this._data[k] = {
						data: newData[i],
						last_updated: now,
					};
				}
				else {
					// Update cache object
					cached[idx].data = newData[i];
					cached[idx].last_updated = now;
				}
			}
		}

		// Clean if needed
		if (now - this._last_cleanup > 2 * this.invalidate_time)
			this._clean();

		// Return data
		if (!Array.isArray(key))
			return cached[0].data as K extends ReadonlyArray<infer A> ? T[] : T;
		else
			return cached.map(x => x.data) as K extends ReadonlyArray<infer A> ? T[] : T;
	}


	/**
	 * The object with the given key is invalidated, forcing it to
	 * be refetched on next access. It will be cleared from the cache
	 * on the next cleanup.
	 *
	 * @param key The key of the object to invalidate from the cache
	 */
	invalidate(key: string): void {
		const cached = this._data[key];
		if (cached)
			cached.last_updated = 0;
	}
}
