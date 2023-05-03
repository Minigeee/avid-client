import { DependencyList, useState, useEffect, Dispatch, SetStateAction } from 'react';


/** useMemo + useState with undefined as valid return type */
export function useMemoState<T>(factory: () => T, dependencies?: DependencyList): [T, Dispatch<SetStateAction<T>>] {
	const [value, setValue] = useState<T>(factory);
	useEffect(() => setValue(factory()), dependencies);
	return [value, setValue];
}