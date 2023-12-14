import {
  DependencyList,
  useState,
  useEffect,
  Dispatch,
  SetStateAction,
} from 'react';

////////////////////////////////////////////////////////////
const _cache: Record<string, any> = {};

/** useMemo + useState with undefined as valid return type */
export function useMemoState<T>(
  factory: () => T,
  dependencies?: DependencyList,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(factory);
  useEffect(() => setValue(factory()), dependencies);
  return [value, setValue];
}

/** nonblocking useMemo + useState with undefined as valid return type */
export function useMemoStateAsync<T>(
  key: string,
  factory: () => Promise<T>,
  dependencies?: DependencyList,
): [T | undefined, Dispatch<SetStateAction<T | undefined>>] {
  const [value, setValue] = useState<T | undefined>(_cache[key]);
  useEffect(() => {
    setTimeout(
      () =>
        factory().then((v) => {
          setValue(v);
          _cache[key] = v;
        }),
      0,
    );
  }, dependencies);
  return [value, setValue];
}
