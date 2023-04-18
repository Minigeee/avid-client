import { useContext } from 'react';
import { SessionContext } from '@/lib/contexts/session';


/**
 * Get current session from latest session provider
 * 
 * @returns The current session context
 */
export function useSession() {
	return useContext(SessionContext);
}