import { query, sql } from '@/lib/db/query';

import { AuthProviders } from '@/lib/utility/authenticate';
import { NoId, User } from '@/lib/types';

import { uid } from 'uid';


/**
 * Get a user object from user id
 * 
 * @param user_id The id of the user to find
 * @returns The corresponding user object
 */
async function get(user_id: string) {
	const users = await query<User[]>(
		sql.select('*', { from: user_id })
	);

	return users.length > 0 ? users[0] : null;
}


/**
 * Get or create a user object using auth provider info
 * 
 * @param provider_id User id within provider's auth system
 * @param provider The auth provider
 * @param email An email that should be provided if first sign up to store data
 * @returns The corresponding user object
 */
function getByProvider(provider_id: string, provider: AuthProviders, email?: string) {
	return query<User>(sql.multi([
		// Select user that matches provider info
		sql.let('$user', sql.select('*', {
			from: 'users',
			where: sql.match({ provider_id, provider }),
		})),

		// Check if the user exists, if not create one
		sql.if({
			cond: '$user',
			body: '$user[0]',
		}, {
			body: sql.create('users', {
				provider_id,
				provider,
				profiles: [],
				email,

				current_profile: null,

				_id_key: uid(),
			} as NoId<User>),
		}),
	]));
}


/**
 * Update a user object with new data
 * 
 * @param user_id The id of the user to update
 * @param data The new data
 * @returns The new user object
 */
async function update(user_id: string, data: Partial<User>) {
	const users = await query<User[]>(
		sql.update<User>(user_id, data)
	);

	return users.length > 0 ? users[0] : null;
}


/** User data functions */
export const users = {
	get,
	getByProvider,
	update,
};