import { useContext } from 'react';
import { AppContext } from '@/lib/contexts/app';

/**
 * Get app context. App context holds current state for all
 * areas of app (navigation, settings, etc.).
 *
 * @returns The current app context
 */
export function useApp() {
  return useContext(AppContext);
}
