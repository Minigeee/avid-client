import { query, sql } from '@/lib/db/query';

import { SessionContextState } from '@/lib/contexts';
import { useSession } from '@/lib/hooks';
import { NoId, Profile, User } from '@/lib/types';


/** Creates db functions */
function factory(session?: SessionContextState) {
	return {
		/**
		 * Create a new profile.
		 * 
		 * @param username The username to assign to profile
		 */
		create: async (user_id: string, username: string, make_current: boolean = false) => {
			const statements = [
				sql.let('$profile', sql.create('profiles', { username })),
				sql.relate('$profile', 'profile_of', user_id),
				sql.select<Profile>(['id'], { from: '$profile' }),
			];
		
			// If the new profile should be made current, update the user object
			if (make_current)
				statements.splice(2, 0, sql.update<User>(user_id, { current_profile: '$profile.id' }, { return: 'NONE' }));
		
			// Execute query
			const results = await query<Profile[]>(
				sql.transaction(statements),
				{ session }
			);
		
			return results && results.length > 0 ? results[0].id : null;
		},
	};
}


/** Profile data functions without session */
export const profiles = factory();


const _cache: Record<string, ReturnType<typeof factory>> = {};

/** Get profiles db functions using current session */
export function useProfilesDb() {
	const session = useSession();
	const key = session.token.split('.').at(-1);

	if (key) {
		if (!_cache[key])
			_cache[key] = factory(session);
		return _cache[key];
	}

	return profiles;
}