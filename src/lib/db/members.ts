import assert from 'assert';

import config from '@/config';
import { ExpandedMember, Member } from '@/lib/types';
import { SessionState } from '@/lib/contexts';
import { query, sql } from '@/lib/db';

import { AsyncCache } from '@/lib/utility/cache';

import { Mutex } from 'async-mutex';


/** Mutex used to access caches */
const _mutex = new Mutex();
/** Member caches for each domain */
const _caches: Record<string, {
	/** A cache containing members */
	cache: AsyncCache<ExpandedMember>;
	/** Maps member query to the time it was requested */
	queries: Record<string, number>;
}> = {};

/** Which fields should be selected */
const MEMBER_SELECT_FIELDS = [
	'in AS id',
	'alias',
	'roles',
	'in.profile_picture AS profile_picture',
];


/**
 * Get domain's member cache, or create a new one if it doesn't exist
 * 
 * @param domain_id The domain id of the member cache to retrieve
 * @returns An object containing the member object cache and a map of query times
 */
export async function getDomainCache(domain_id: string, session: SessionState, throwOnMissing?: boolean) {
	assert(domain_id.startsWith('domains:'));

	const release = await _mutex.acquire();

	// Check if cache data exists
	const data = _caches[domain_id];

	try {
		if (!data) {
			console.log('refetch members')

			// Throw if specified
			if (throwOnMissing) throw new Error('domain cache missing');

			// Get initial data for cache
			const members = await query<ExpandedMember[]>(
				sql.select<ExpandedMember>(MEMBER_SELECT_FIELDS, {
					from: `${domain_id}<-member_of`,
					limit: config.app.member.query_limit,
				}),
				{ session }
			);
			assert(members);

			const now = Date.now();

			// Create cache
			const cache = new AsyncCache<ExpandedMember>(async (keys) => (await query<ExpandedMember[]>(
				sql.select(MEMBER_SELECT_FIELDS, {
					from: `${domain_id}<-(member_of WHERE in INSIDE [${keys.join(',')}])`,
					limit: config.app.member.query_limit,
				}),
				{ session }
			)) || [], config.app.member.cache_lifetime);

			// Add initial members
			cache.add(members.map(x => x.id), members);

			_caches[domain_id] = {
				cache,
				queries: { '': now },
			};

			return _caches[domain_id];
		}
	}
	finally {
		release();
	}

	return data;
}


/**
 * Get a member from a domain. The local cache is first checked
 * and if valid data exists, it is used. Otherwise, the data is fetched
 * from the api server.
 * 
 * @param domain_id The id of the domain to retrieve the member from
 * @param member_id The id of the member to retrieve
 */
export async function getMember(domain_id: string, member_id: string, session: SessionState) {
	const data = await getDomainCache(domain_id, session);

	// Return cached data
	assert(member_id.startsWith('profiles:'));
	return await data.cache.get(member_id);
}


/**
 * Get a list members from a domain. The local cache is first checked
 * and if valid data exists, it is used. Otherwise, the data is fetched
 * from the api server.
 * 
 * @param domain_id The id of the domain to retrieve the member from
 * @param member_ids The ids of the members to retrieve
 */
export async function getMembers(domain_id: string, member_ids: string[], session: SessionState) {
	if (!member_ids.length) return [];

	const data = await getDomainCache(domain_id, session);

	// Return cached data
	for (const id of member_ids)
		assert(id.startsWith('profiles:'));
	return await data.cache.get(member_ids);
}


/**
 * Get members from a domain that match the specified query. The local cache is first checked
 * and if valid data exists, it is used. Otherwise, the data is fetched
 * from the api server.
 * 
 * @param domain_id The id of the domain to retrieve the member from
 * @param substr The alias query to use for searching
 */
export async function listMembers(domain_id: string, search: string, session: SessionState) {
	const data = await getDomainCache(domain_id, session);

	// Check when this query was last performed
	search = search.toLowerCase();
	const queryTime = data.queries[search];

	// Fetch data if needed
	if (!queryTime || Date.now() - queryTime > config.app.member.query_interval * 1000) {
		const members = await query<ExpandedMember[]>(
			sql.select<ExpandedMember>(MEMBER_SELECT_FIELDS, {
				from: `${domain_id}<-member_of`,
				where: search ? undefined : `string::lowercase(alias) CONTAINS '${search}'`,
				limit: config.app.member.query_limit,
			}),
			{ session }
		);
		if (!members) return [];

		// Update cache
		data.cache.add(members.map(x => x.id), members);

		// Update query
		data.queries[search] = Date.now();

		return members;
	}

	// Construct members array
	const members: ExpandedMember[] = [];
	for (const m of Object.values(data.cache._data)) {
		if (m.data?.alias.toLowerCase().includes(search))
			members.push(m.data);
	}

	return members;
}


/**
 * A synchronous alternative to member fetching. If the data does not
 * exist, null will be returned. After returning existing data, new data will be
 * fetched if no data exists or existing data is stale.
 * Any data that is returned may be stale.
 * 
 * @param domain_id The id of the domain to retrieve the member from
 * @param member_id The id of the member to retrieve
 * @param refresh Indicates if cache stale check should be proc'd
 * @returns The member if it exists, otherwise null
 */
export function getMemberSync(domain_id: string, member_id: string, refresh: boolean = true) {
	const data = _caches[domain_id];
	if (!data) return null;

	// Get cache data to proc validation check
	assert(member_id.startsWith('profiles:'));
	if (refresh)
		data.cache.get(member_id);

	return data.cache._data[member_id]?.data || null;
}