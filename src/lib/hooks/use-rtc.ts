import { useContext } from 'react';
import { RtcContext } from '@/lib/contexts/rtc';


/**
 * Get current rtc context
 * 
 * @returns The current rtc context
 */
export function useRtc() {
	return useContext(RtcContext);
}