import { query, sql } from '@/lib/db/query';

import { NoId, Profile, RemoteAppState, User } from '@/lib/types';

/** Profile data functions without session */
export const profiles = {
  /**
   * Create a new profile.
   *
   * @param username The username to assign to profile
   * @returns The id of the new profile
   */
  create: async (
    user_id: string,
    username: string,
    make_current: boolean = false,
  ) => {
    const statements = [
      sql.let(
        '$profile',
        sql.single(
          sql.create<Profile>('profiles', {
            username,
            time_created: new Date().toISOString(),
          }),
        ),
      ),
      sql.relate('$profile', 'profile_of', user_id),
      sql.select<Profile>(['id'], { from: '$profile' }),
    ];

    // If the new profile should be made current, update the user object
    if (make_current) {
      statements.splice(
        2,
        0,
        sql.update<User>(user_id, {
          content: { current_profile: sql.$('$profile.id') },
          return: 'NONE',
        }),
      );
    }

    // Execute query
    const results = await query<Profile>(sql.transaction(statements));

    return results?.id || null;
  },
};
