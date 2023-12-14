import { query, sql } from '@/lib/db/query';

import { SessionState } from '@/lib/contexts';
import { useSession } from '@/lib/hooks';
import { AuthProviders } from '@/lib/utility/authenticate';
import { NoId, User } from '@/lib/types';

import { uid } from 'uid';

/** Creates db functions */
function factory(session?: SessionState) {
  return {
    /**
     * Get a user object from user id
     *
     * @param user_id The id of the user to find
     * @returns The corresponding user object
     */
    get: async (user_id: string) => {
      const users = await query<User[]>(sql.select('*', { from: user_id }), {
        session,
      });

      return users && users.length > 0 ? users[0] : null;
    },

    /**
     * Get or create a user object using auth provider info
     *
     * @param provider_id User id within provider's auth system
     * @param provider The auth provider
     * @param email An email that should be provided if first sign up to store data
     * @returns The corresponding user object
     */
    getByProvider: (
      provider_id: string,
      provider: AuthProviders,
      email: string | undefined,
      alpha_key: string,
    ) => {
      return query<User>(
        sql.multi([
          // Select user that matches provider info
          sql.let(
            '$user',
            sql.single(
              sql.select('*', {
                from: 'users',
                where: sql.match({ provider_id, provider }),
              }),
            ),
          ),

          // Check if the user exists, if not create one
          sql.if(
            {
              cond: '$user',
              body: '$user',
            },
            {
              cond: `_system:${process.env.NODE_ENV}.alpha_key = '${alpha_key}'`,
              body: sql.single(
                sql.create('users', {
                  time_created: new Date().toISOString(),
                  provider_id,
                  provider,
                  email,

                  current_profile: null,

                  _id_key: uid(),
                } as NoId<User>),
              ),
            },
            {
              body: 'null',
            },
          ),
        ]),
        { session },
      );
    },

    /**
     * Update a user object with new data
     *
     * @param user_id The id of the user to update
     * @param data The new data
     * @returns The new user object
     */
    update: async (user_id: string, data: Partial<User>) => {
      const users = await query<User[]>(
        sql.update<User>(user_id, { content: data }),
        { session },
      );

      return users && users.length > 0 ? users[0] : null;
    },
  };
}

/** User data functions */
export const users = factory();

const _cache: Record<string, ReturnType<typeof factory>> = {};

/** Get profiles db functions using current session */
export function useUsersDb() {
  const session = useSession();
  const key = session.token.split('.').at(-1);

  if (key) {
    if (!_cache[key]) _cache[key] = factory(session);
    return _cache[key];
  }

  return users;
}
