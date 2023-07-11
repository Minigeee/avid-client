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
	queries: Record<string, {
		/** The time the query was performed */
		time: number;
		/** The number of results returned in the query */
		count?: number;
	}>;
}> = {};

/** Which fields should be selected */
const MEMBER_SELECT_FIELDS = [
	'in AS id',
	'is_admin',
	'is_owner',
	'alias',
	'roles',
	'in.profile_picture AS profile_picture',
];


/** Get the map of queries that are cached */
export function getMemberQueries(domain_id: string) {
	return _caches[domain_id].queries;
}

/** Create query key from the given options */
export function getMemberQueryKey(options: MemberListOptions) {
	// Create query string
	const constraints: string[] = [];

	if (options.search)
		constraints.push(`search=${options.search.toLocaleLowerCase()}`);
	if (options.role_id)
		constraints.push(`role=${options.role_id}`);
	else if (options.exclude_role_id)
		constraints.push(`role!=${options.role_id}`);
	if (options.limit !== undefined)
		constraints.push(`limit=${Math.min(options.limit, config.app.member.query_limit)}`);
	if (options.page)
		constraints.push(`page=${options.page}`);

	// Query key
	return constraints.length ? constraints.join('&') : '';
}

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
				queries: { '': { time: now } },
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


/** List member options */
export type MemberListOptions = {
	/** The string to search for in member alias */
	search?: string;
	/** Only include members that have the specified role (mutually exclusive w/ `exclude_role_id`, this takes priority) */
	role_id?: string;
	/** Exclude members that have the specified role (mutually exclusive w/ `role_id`) */
	exclude_role_id?: string;
	/** Limit the number of members returned, the app limit will override this limit if this limit is larger */
	limit?: number;
	/** The page of results to return */
	page?: number;
};

/** Object returned from member list query */
export type MemberListResults = {
	/** The members from the query */
	data: ExpandedMember[];
	/** The total number of results in query, only available for paginated queries */
	count?: number;
};

/**
 * Get members from a domain that match the specified query. The local cache is first checked
 * and if valid data exists, it is used. Otherwise, the data is fetched
 * from the api server.
 * 
 * @param domain_id The id of the domain to retrieve the member from
 * @param substr The alias query to use for searching
 */
export async function listMembers(domain_id: string, options: MemberListOptions, session: SessionState): Promise<MemberListResults> {
	const data = await getDomainCache(domain_id, session);
	
	const search = options.search?.toLocaleLowerCase();
	const limit = Math.min(options.limit || 1000000000, config.app.member.query_limit);

	// Check when this query was last performed
	const queryKey = getMemberQueryKey(options);
	const queryTime = data.queries[queryKey]?.time || 0;

	// Fetch data if needed
	if (!queryTime || Date.now() - queryTime > config.app.member.query_interval * 1000) {
		const paged = options.page !== undefined;

		// Match string
		let matchConstraints: string[] = [];
		if (search)
			matchConstraints.push(`string::lowercase(alias) CONTAINS '${search}'`);
		if (options.role_id)
			matchConstraints.push(`roles CONTAINS ${options.role_id}`);
		else if (options.exclude_role_id)
			matchConstraints.push(`roles CONTAINSNOT ${options.exclude_role_id}`);
		const matchStr = matchConstraints.join('&&');

		// Construct db query
		const ops = [
			sql.select<ExpandedMember>(MEMBER_SELECT_FIELDS, {
				from: `${domain_id}<-member_of`,
				where: matchStr || undefined,
				limit,
				start: options.page !== undefined ? options.page * limit : undefined,
				sort: [{ field: 'is_admin', order: 'DESC' }, { field: 'alias', mode: 'COLLATE' }],
			}),
		];
		
		// If paged request, the get total count as well
		if (paged) {
			ops.push(sql.select<ExpandedMember>(['count()'], {
				from: `${domain_id}<-member_of`,
				where: matchStr || undefined,
				groupAll: true,
			}));
		}

		const results = await query<[ExpandedMember[], { count: number }[]]>(
			sql.multi(ops),
			{ session, complete: true }
		);
		if (!results || !results[0]) return { data: [] };

		// Update cache
		const members = results[0];
		const count = results.length > 1 ? results[1][0]?.count || 0 : undefined;
		data.cache.add(members.map(x => x.id), members);

		// Update query time and count
		data.queries[queryKey] = {
			time: Date.now(),
			count,
		};

		return { data: members, count };
	}

	// Construct members array
	let members: ExpandedMember[] = [];
	for (const m of Object.values(data.cache._data)) {
		if (m.data &&
			(!search || m.data.alias.toLowerCase().includes(search)) &&
			(!options.role_id || (m.data.roles && m.data.roles.findIndex(x => x === options.role_id) >= 0)) &&
			(!options.exclude_role_id || (!m.data.roles || m.data.roles.findIndex(x => x === options.exclude_role_id) < 0))
		)
			members.push(m.data);
	}

	// Sorting if no search
	if (!search)
		members.sort((a, b) => a.alias ? b.alias ? a.alias.localeCompare(b.alias) : 1 : -1);

	// Apply pagination
	const start = options.page ? options.page * limit : 0;
	if (options.limit)
		members = members.slice(start, start + limit);

	return { data: members, count: data.queries[queryKey].count };
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