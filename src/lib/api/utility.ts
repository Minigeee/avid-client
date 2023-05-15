import assert from 'assert';

import { SessionState } from '@/lib/contexts'; 
import { AxiosRequestConfig } from 'axios';


/**
 * Create an axios config object with the correct auth header attached
 * 
 * @param session The current user session which contains access token
 * @param options Extra axios request configurations
 * @returns An axio request config object with auth headers
 */
export function withAccessToken(session: SessionState, options: AxiosRequestConfig = {}): AxiosRequestConfig {
	assert(session._exists);

	return {
		...options,
		headers: {
			...options.headers,
			Authorization: `Bearer ${session.token}`,
		},
	};
}