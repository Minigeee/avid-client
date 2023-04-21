import { createContext, PropsWithChildren, useState } from 'react';

import axios, { AxiosError } from 'axios';
import { decode } from 'jsonwebtoken';
import { setUser } from '@sentry/nextjs';

import config from '@/config';
import { axiosHandler } from '@/lib/utility/error-handler';


/** Holds session state */
export type SessionState = {
	/** Session exists or not */
	_exists: boolean;
	/** Jwt access token */
	token: string;
	/** User id */
	user_id: string;
	/** Currently active profile id */
	profile_id: string;
};


function _hasAccessToken(session: SessionState) {
	if (!session?.token) return false;
	const payload: any = decode(session.token);
	return payload?.exp !== undefined && Date.now() < payload.exp * 1000;
}

/** Creates mutator functions for session (not all funcs are mutators) */
function mutatorFactory(session: SessionState, setSession: (state: SessionState) => unknown) {
	return {
		/**
		 * Checks if user has a valid access token, which is needed to access database.
		 * 
		 * @returns True if the user has a valid access token
		 */
		hasAccessToken: () => _hasAccessToken(session),

		/**
		 * Refresh access token.
		 * 
		 * @param force Whether access token refresh should be forced
		 * @returns The access token if refresh was successful, undefined if the user is not authenticated
		 */
		refresh: async (force: boolean = false) => {
			// Don't need to refresh if still have access token
			if (!force && _hasAccessToken(session)) return session.token;

			// Get access token
			let token: string;
			try {
				const result = await axios.post(
					`${config.domains.site}/api/login/refresh`,
					undefined,
					{ withCredentials: true }
				);
				token = result.data.token;

			} catch (error: any) {
				// Throw error if authenticated, but still errored
				if (error.response?.status !== 401)
					axiosHandler(error);

				return;
			}

			// Set session data
			const payload: any = decode(token);
			setSession({
				_exists: true,
				token,
				user_id: payload.user_id,
				profile_id: payload.profile_id,
			});

			// Set user for error logging
			setUser({
				id: payload.profile_id || payload.user_id,
				email: payload.email,
			});

			return token;
		},

		/**
		 * Sets the currently active profile (does not make any database changes).
		 * 
		 * @param profile_id The profile id that should be made the current
		 */
		setProfile: (profile_id: string) => {
			setSession({ ...session, profile_id });
		},
	};
}


/** Session context state */
export type SessionContextState = SessionState & ReturnType<typeof mutatorFactory>;

/** Session context */
// @ts-ignore
export const SessionContext = createContext<SessionContextState>();

////////////////////////////////////////////////////////////
export default function SessionProvider({ children }: PropsWithChildren) {
	const [session, setSession] = useState<SessionState>({
		_exists: false,
		token: '',
		user_id: '',
		profile_id: '',
	});

	return (
		<SessionContext.Provider value={{ ...session, ...mutatorFactory(session, setSession) }}>
			{children}
		</SessionContext.Provider>
	);
}