import { useSyncExternalStore } from 'react';


/** Listeners */
const _listeners: Record<string, (() => void)[]> = {};


/**
 * Set up for using an external store with react
 * 
 * @param key A unique id for the store
 * @param store The store object wrapper (the key-value store should be put in a field called `store` so that this function always has access to the latest store value)
 * @returns Functions used to access and emit store change event
 */
export function makeExternalStore<T extends Record<string, any>>(key: string, store: { store: T }) {
	if (!_listeners[key])
		_listeners[key] = [];

	// Add listener
	function _subscribe(listener: () => void) {
		_listeners[key] = [..._listeners[key], listener];
		return () => {
			_listeners[key] = _listeners[key].filter(l => l !== listener);
		};
	}

	// Get store
	function _getSnapshot() {
		return store.store;
	}

	/** Emits store data change event */
	function emit() {
		for (const listener of _listeners[key])
			listener();
	}

	/** Hook for syncing external store */
	function useExternalStore() {
		return useSyncExternalStore(_subscribe, _getSnapshot);
	}


	return { useExternalStore, emit };
}