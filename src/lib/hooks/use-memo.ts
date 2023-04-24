import { DependencyList, useState, useEffect, Dispatch, SetStateAction } from 'react';

/** useMemo with undefined as valid return type */
export function useMemo<T>(factory: () => T | undefined, dependencies?: DependencyList): T | undefined {
	const [value, setValue] = useState<T | undefined>(factory);
	useEffect(() => setValue(factory()), dependencies);
	return value;
}

/** useMemo + useState with undefined as valid return type */
export function useMemoState<T>(factory: () => T | undefined, dependencies?: DependencyList): [T | undefined, Dispatch<SetStateAction<T | undefined>>] {
	const [value, setValue] = useState<T | undefined>(factory);
	useEffect(() => setValue(factory()), dependencies);
	return [value, setValue];
}