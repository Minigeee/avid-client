import { useEffect, useState } from 'react';

////////////////////////////////////////////////////////////
const _cache: Record<string, any> = {};

/** useState with a cache */
export function useCachedState<T>(
  key: string,
  fallback: T,
  force?: T,
): [T, (value: T) => void] {
  const [state, setState] = useState<T>(
    force === undefined
      ? _cache[key] === undefined
        ? fallback
        : _cache[key]
      : force,
  );
  return [
    state,
    (value: T) => {
      _cache[key] = value;
      setState(value);
    },
  ];
}

export { _cache as cache };
