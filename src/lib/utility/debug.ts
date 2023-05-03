
/** Print only in dev mode */
export function debug(...args: any[]) {
	if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development')
		console.log('%cDEBUG', 'color: #40C057; font-weight: 600;', ...args);
}