import { query, sql } from '@/lib/db/query';

import { NoId, Profile, User } from '@/lib/types';


/**
 * Create a new profile.
 * 
 * @param username The username to assign to profile
 */
async function create(user_id: string, username: string, make_current: boolean = false) {
	const statements = [
		sql.let('$profile', sql.create('profiles', { username })),
		sql.relate('$profile', 'profile_of', user_id),
		sql.select<Profile>(['id'], { from: '$profile' }),
	];

	// If the new profile should be made current, update the user object
	if (make_current)
		statements.splice(2, 0, sql.update<User>(user_id, { current_profile: '$profile.id' }, { return: 'NONE' }));

	// Execute query
	const results = await query<Profile[]>(sql.transaction(statements));

	return results.length > 0 ? results[0].id : null;
}


export const profiles = {
	create,
};