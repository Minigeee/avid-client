import { createContext, PropsWithChildren, useState } from 'react';

import axios, { AxiosError } from 'axios';
import { decode } from 'jsonwebtoken';
import { setUser } from '@sentry/nextjs';

import config from '@/config';
import { axiosHandler } from '@/lib/utility/error-handler';

/** Holds session state */
type _SessionState = {
  /** Session exists or not */
  _exists: boolean;
  /** Jwt access token */
  token: string;
  /** User id */
  user_id: string;
  /** Currently active profile id */
  profile_id: string;
  /** User email */
  email?: string;
};

function _hasAccessToken(session: _SessionState) {
  if (!session?.token) return false;
  const payload: any = decode(session.token);
  return payload?.exp !== undefined && Date.now() < payload.exp * 1000;
}

/** Creates mutator functions for session (not all funcs are mutators) */
function mutatorFactory(
  session: _SessionState,
  setSession: (state: _SessionState) => unknown,
) {
  function setToken(token: string) {
    // Set session data
    const payload: any = decode(token);
    setSession({
      _exists: true,
      token,
      user_id: payload.user_id,
      profile_id: payload.profile_id,
      email: payload.email,
    });

    // Set user for error logging
    setUser({
      id: payload.profile_id || payload.user_id,
      email: payload.email,
    });
  }

  return {
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
        const result = await axios.post('/api/login/refresh', undefined, {
          withCredentials: true,
        });
        token = result.data.token;
      } catch (error: any) {
        // Throw error if authenticated, but still errored
        if (error.response?.status !== 401) axiosHandler(error);

        return;
      }

      // Apply token
      setToken(token);

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

    /**
     * Applies a token string.
     *
     * @param token The token to decode and apply
     */
    applyToken: setToken,
  };
}

/** Session context state */
export type SessionState = _SessionState & {
  _mutators: ReturnType<typeof mutatorFactory>;
};

/** Session context */
// @ts-ignore
export const SessionContext = createContext<SessionState>();

////////////////////////////////////////////////////////////
export default function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<_SessionState>({
    _exists: false,
    token: '',
    user_id: '',
    profile_id: '',
  });

  return (
    <SessionContext.Provider
      value={{ ...session, _mutators: mutatorFactory(session, setSession) }}
    >
      {children}
    </SessionContext.Provider>
  );
}
