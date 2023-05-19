import { useState } from 'react';


/** A hook for more convenient setTimeout */
export function useTimeout(fn: () => void, interval: number) {
	const [id, setId] = useState<NodeJS.Timeout | null>(null);

	return {
		/** Indicates if the timeout timer is active */
		isActive: id !== null,
		/** Start the timeout. If the timer is active when this is called, the previous timer is cleared. */
		start: () => {
			// Clear the previous timeout
			if (id) clearTimeout(id);
			
			// Start new timeout
			setId(setTimeout(() => {
				// Clear id
				setId(null);

				// Callback func
				fn();
			}, interval));
		},
		/** Clear the timeout */
		clear: () => {
			if (id) {
				clearTimeout(id);
				setId(null);
			}
		},
	};
}