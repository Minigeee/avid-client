import { createContext, PropsWithChildren, useState } from 'react';


/** Storage context, this storage object should be treated as a mutable data container.
 * It does not follow immutable states like other state management in react so it should only be relied
 * on for caches and data that will not be rendered. */
export const StorageContext = createContext<Record<string, any>>({});

////////////////////////////////////////////////////////////
export default function StorageProvider({ children }: PropsWithChildren) {
	return (
		<StorageContext.Provider value={{}}>
			{children}
		</StorageContext.Provider>
	);
}