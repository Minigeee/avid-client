
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


export function diff<B extends any>(origObj: any, newObj: B): Partial<B> | undefined {
	if (origObj == null && newObj != null) {
		// new is diff + non-null
		return newObj;
	}
	else if (origObj != null && newObj == null) {
		// new is diff + null
		return null as B;
	}
	else if (origObj == null && newObj == null) {
		// Same
		return undefined;
	}
	else if (typeof origObj !== typeof newObj) {
		// new is diff
		return newObj;
	}
	else  {
		if (newObj === origObj)
			return undefined;
		else if (Array.isArray(origObj) && Array.isArray(newObj)) {
			// Return entire array if it is diff
			if (origObj.length !== newObj.length || origObj.findIndex((x, i) => x !== newObj[i]) < 0)
				return newObj;
		}
		else if (typeof origObj === 'object') {
			// Set of keys
			const keys = new Set<string>(Object.keys(origObj).concat(Object.keys(newObj as object)));
	
			const obj: any = {};
			for (const k of Array.from(keys)) {
				const propDiff = diff(origObj[k], newObj[k as keyof B]);
				if (propDiff !== undefined)
					obj[k] = propDiff;
			}

			return Object.keys(obj).length > 0 ? obj : undefined;
		}
		else if (newObj !== origObj)
			return newObj;
		else
			return undefined;
	}

	return undefined;
}