
/**
 * Remap an object property to another property for all objects within an array.
 * The old property will still exist after the remap.
 * 
 * @param arr The array to perform remap on
 * @param from The property to map from
 * @param to The property to map to
 * @returns A new array with remapped properties
 */
export function remap<T, From extends keyof T, To extends string>(arr: T[], from: From, to: To): (T & { [_ in To]: T[From] })[] {
	return arr.map(x => ({ [to]: x[from], ...x })) as (T & { [_ in To]: T[From] })[];
}


/**
 * Sort an object by its entries
 * 
 * @param x The object to sort
 * @param compareFn The compare function
 * @returns A new object sorted by key
 */
export function sortObject<T extends Record<any, any>>(x: T, compareFn?: (a: [string, T[keyof T]], b: [string, T[keyof T]]) => number): T {
	// @ts-ignore
	return Object.entries(x).sort(compareFn || (([a], [b]) => a.localeCompare(b))).reduce(
		(obj: any, [k, v]: [string, any]) => {
			obj[k] = v;
			return obj;
		},
		{}
	);
}