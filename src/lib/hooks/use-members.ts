import { useContext, useMemo, useState, useSyncExternalStore } from 'react';
import assert from 'assert';

import config from '@/config';
import { ExpandedMember } from '@/lib/types';
import { api } from '@/lib/api';
import { SessionState } from '@/lib/contexts';

import { useSession } from './use-session';
import { errorWrapper } from '@/lib/utility/error-handler';


/** Member cache entry */
export type MemberEntry = {
	/** Member data */
	data: ExpandedMember;
	/** Time the entry was updated */
	time: number;
};

/** Member cache */
type MemberCache = Record<string, MemberEntry>;

/** Query entry */
export type QueryEntry = {
	/** The time the query was performed */
	time: number;
	/** The total number of results existing for the query */
	total: number;
};

/** Query cache */
type QueryCache = Record<string, QueryEntry>;


/** Global state */
const _ = {
	/** Member cache */
	members: {} as Record<string, MemberCache>,
	/** Query cache */
	queries: {} as QueryCache,
	/** Map of keys that are loading a fetch */
	loading: new Set<string>(),
	/** List of listeners */
	listeners: [] as (() => void)[],
};


/** Subscribe func for external store */
function _subscribe(listener: () => void) {
	_.listeners = [..._.listeners, listener];
	return () => {
		_.listeners = _.listeners.filter(l => l !== listener);
	};
}

/** Snapshot func for external store */
function _getSnapshot() {
	return _.members;
}

/** Function to notify that store changes occurred */
function _emitChange() {
	for (const listener of _.listeners)
		listener();
}

/** Checks if an entry needs to be fetched */
function _needFetch(key: string, entry: { time: number } | undefined, lifetime: number = config.app.member.cache_lifetime) {
	return (entry === undefined || entry === null || Date.now() - entry.time >= lifetime * 1000) && (!key || !_.loading.has(key));
}

/** Gets member entry */
function _getMemberEntry(domain_id: string, profile_id: string, cache: Record<string, MemberCache> = _.members) {
	return cache[domain_id]?.[profile_id] as MemberEntry | undefined;
}


/** Set members to store */
export function setMembers(domain_id: string, members: ExpandedMember[], emit: boolean = true) {
	const now = Date.now();

	// Get domain cache
	let domain = _.members[domain_id];
	if (!domain)
		domain = _.members[domain_id] = {};
	else
		domain = { ...domain };

	// Set all members
	for (const member of members)
		domain[member.id] = { data: member, time: now };

	_.members = { ..._.members, [domain_id]: domain };

	// Emit changes
	if (emit)
		_emitChange();
}

/** Set member query data */
export function setMemberQuery(domain_id: string, options: MemberQueryOptions, count: number) {
	const queryKey = _getQueryKey(domain_id, options);
	_.queries[queryKey] = { time: Date.now(), total: count };
}


/** Get member mutators */
export function useMemberMutators() {
	const session = useSession();

	return {
		/**
		 * Add a single role to multiple members of a domain
		 * 
		 * @param domain_id The domain of the members
		 * @param profile_ids The list of profiles to add the role to
		 * @param role_id The id of the role to add
		 */
		addRoles: errorWrapper(async (domain_id: string, profile_ids: string[], role_id: string) => {
			const results = await api('PATCH /roles/:role_id/members', {
				params: { role_id },
				body: { members: profile_ids },
			}, { session });

			// Set new members to cache
			setMembers(domain_id, results);
		}, { message: 'An error occurred while adding role to members' }),

		/**
		 * Remove a role from a member
		 * 
		 * @param domain_id The domain of the member
		 * @param profile_id The profile of the member
		 * @param role_id The id of the role to remove
		 */
		removeRole: errorWrapper(async (domain_id: string, profile_id: string, role_id: string) => {
			// Optimistic update
			const entry = _getMemberEntry(domain_id, profile_id);
			if (entry)
				// Set new member to cache
				setMembers(domain_id, [{ ...entry.data, roles: entry.data.roles?.filter(r => r !== role_id) }]);

			await api('DELETE /members/:member_id/roles/:role_id', {
				params: { member_id: profile_id, role_id },
				query: { domain: domain_id },
			}, { session });
		}, {
			message: 'An error occurred while removing role from member',
			onError: (err, domain_id: string, profile_id: string, role_id: string) => {
				// Revert change
			const entry = _getMemberEntry(domain_id, profile_id);
				if (entry)
					setMembers(domain_id, [{ ...entry.data, roles: [...(entry.data.roles || []), role_id] }]);
			},
		})
	};
}

export type MemberMutators = ReturnType<typeof useMemberMutators>;


/**
 * Get member cache. Should be used in a component for it to recieve member cache changes.
 * 
 * @returns Member cache
 */
export function useMemberCache() {
	return useSyncExternalStore(_subscribe, _getSnapshot);
}


/** Single member wrapper */
export type MemberWrapper<Loaded extends boolean = true> = ({ _exists: true } & ExpandedMember) | (Loaded extends true ? never : { _exists: false } & Partial<ExpandedMember>);

/**
 * Get a single member from a domain
 * 
 * @param domain_id The domain to retrieve the member from
 * @param profile_id The profile id of the member
 * @returns The member
 */
export function useMember(domain_id: string, profile_id: string | undefined) {
	const session = useSession();
	const members = useSyncExternalStore(_subscribe, _getSnapshot);

	return useMemo(() => {
		if (!profile_id)
			return { _exists: false } as MemberWrapper<false>;

		const key = `${domain_id}.${profile_id}`;
		const cached = _getMemberEntry(domain_id, profile_id);
		const _exists = cached !== undefined;

		// Check if need fetch
		const needFetch = _needFetch(key, cached);
		if (needFetch) {
			_.loading.add(key);

			// Fetch member and set to store
			api('GET /members/:member_id', {
				params: { member_id: profile_id },
				query: { domain: domain_id },
			}, { session })
				.then((member) => {
					setMembers(domain_id, [member]);
					_.loading.delete(key);
				});
		}

		// Return null or existing while refetching
		return { ...cached?.data, _exists } as MemberWrapper<false>;
	}, [domain_id, profile_id, members]);
}


/** Multi member wrapper */
export type MembersWrapper<Loaded extends boolean = true> = ({ _exists: true; data: ExpandedMember[] }) | (Loaded extends true ? never : { _exists: false; data?: ExpandedMember[] });

/**
 * Get a single member from a domain
 * 
 * @param domain_id The domain to retrieve the member from
 * @param profile_id The profile id of the member
 * @returns The member
 */
export function useMembers(domain_id: string, profile_ids: string[]) {
	const session = useSession();
	const members = useSyncExternalStore(_subscribe, _getSnapshot);

	return useMemo(() => {
		if (!profile_ids.length)
			return { _exists: true, data: [] };

		let needFetch = false;
		let _exists = true;

		// Cache keys
		const keys = profile_ids.map(id => `${domain_id}.${id}`);

		// Get cached
		const cached: MemberEntry[] = [];
		for (let i = 0; i < profile_ids.length; ++i) {
			const entry = _getMemberEntry(domain_id, profile_ids[i]);
			needFetch = needFetch || _needFetch(keys[i], entry);
			_exists = entry !== undefined;

			if (entry)
				cached.push(entry);
		}

		// Check if need fetch
		if (needFetch) {
			for (const key of keys)
				_.loading.add(key);

			// Fetch member and set to store
			api('GET /members', {
				query: { domain: domain_id, ids: profile_ids },
			}, { session })
				.then((members) => {
					assert(Array.isArray(members))
					setMembers(domain_id, members);

					for (const key of keys)
						_.loading.delete(key);
				});
		}

		// Return null or existing while refetching
		return { _exists, data: _exists ? cached.map(x => x.data) : undefined } as MembersWrapper<false>;
	}, [domain_id, profile_ids, members]);
}


/** Member query options */
export type MemberQueryOptions = {
	/** An alias search value */
	search?: string;
	/** A role to whitelist */
	role_id?: string;
	/** A role to blacklist */
	exclude_role_id?: string;
	/** The page to fetch (if this is excluded, then the first page will be fetched, or if the query has been performed before, all existing members that match the query will be fetched) */
	page?: number;
	/** Indicates if only online/offline members should be included */
	online?: boolean;
	/** Set to true to get only the count */
	no_data?: boolean;
};

/** Member query results */
export type MemberQueryResults = {
	/** The member data */
	data: ExpandedMember[];
	/** The total number of members that match the query */
	count: number;
};

/** Multi member wrapper */
export type MemberQueryWrapper<Loaded extends boolean = true> = ({ _exists: true } & MemberQueryResults) | (Loaded extends true ? never : { _exists: false } & Partial<MemberQueryResults> );

/** Get query key */
function _getQueryKey(domain_id: string, options?: MemberQueryOptions) {
	let key = domain_id;

	const extra: string[] = [];
	if (options?.search)
		extra.push(`search=${options.search.toLocaleLowerCase()}`);
	if (options?.role_id)
		extra.push(`role=${options.role_id}`);
	else if (options?.exclude_role_id)
		extra.push(`exclude_role=${options.exclude_role_id}`);
	if (options?.page)
		extra.push(`page=${options.page}`);
	if (options?.online !== undefined)
		extra.push(`online=${options.online}`);
	if (options?.no_data)
		extra.push(`no_data`);

	return key + (extra.length > 0 ? '?' + extra.join('&') : '');
}

/** Filter member entries according to options */
function _filterEntries(entries: MemberEntry[], options?: MemberQueryOptions) {
	const search = options?.search?.toLocaleLowerCase();
	const limit = config.app.member.query_limit;

	const filtered = entries.filter((entry) =>
		(!search || entry.data.alias.toLocaleLowerCase().indexOf(search) >= 0) &&
		(!options?.role_id || (entry.data.roles && entry.data.roles.indexOf(options.role_id) >= 0)) &&
		(!options?.exclude_role_id || (!entry.data.roles || entry.data.roles.indexOf(options.exclude_role_id) < 0)) &&
		(options?.online === undefined || (entry.data.online || false) == options.online)
	).sort((a, b) => a.data.alias.localeCompare(b.data.alias));

	return options?.page !== undefined ? filtered.slice(options.page * limit, (options.page + 1) * limit) : filtered;
}

/**
 * Get members from a member query
 * 
 * @param domain_id The domain to retrieve the member from
 * @param options The query options
 * @returns The query result
 */
export function useMemberQuery(domain_id: string | undefined, options?: MemberQueryOptions) {
	const session = useSession();
	const members = useSyncExternalStore(_subscribe, _getSnapshot);

	return useMemo(() => {
		if (!domain_id)
			return { _exists: false } as MemberQueryWrapper<false>;

		// Page size
		const limit = config.app.member.query_limit;

		// Get query entry
		const queryKey = _getQueryKey(domain_id, options);
		const queryEntry = _.queries[queryKey];

		// Check if query needs to be refetched
		let _exists = queryEntry !== undefined;
		let needFetch = _needFetch(queryKey, queryEntry, config.app.member.query_interval);

		// Filter results and check for stales if query entry exists
		let filtered: MemberEntry[] = [];
		if (_exists) {
			filtered = _filterEntries(Object.values(_.members[domain_id] || {}), options);
	
			if (!needFetch) {
				for (const entry of filtered) {
					const fetch = _needFetch('', entry);
					if (fetch) {
						needFetch = fetch;
						break;
					}
				}
			}
		}

		// Refetch if needed
		if (needFetch) {
			_.loading.add(queryKey);

			api('GET /members', {
				query: {
					domain: domain_id,
					search: options?.search || undefined,
					role: options?.role_id,
					exclude_role: options?.exclude_role_id,
					online: options?.online,
					limit: limit,
					page: options?.page,
					with_data: options?.no_data ? false : undefined,
				},
			}, { session })
			.then((results) => {
				assert(!Array.isArray(results));

				// Save query results
				console.log(results)
				setMembers(domain_id, results.data);
				_.queries[queryKey] = { time: Date.now(), total: results.count };

				_.loading.delete(queryKey);
			});
		}

		return {
			_exists,
			data: _exists ? filtered.map(x => x.data) : undefined,
			count: queryEntry?.total,
		} as MemberQueryWrapper<false>;

	}, [domain_id, options?.search, options?.role_id, options?.exclude_role_id, options?.page, options?.online, options?.no_data, members]);
}

/**
 * Get members from a member query
 * 
 * @param domain_id The domain to retrieve the member from
 * @param options The query options
 * @param store The member store used to get data from
 * @param session The session object used to authenticate requests
 * @returns The query result
 */
export async function listMembers(domain_id: string, options: MemberQueryOptions, session: SessionState) {
	// Page size
	const limit = config.app.member.query_limit;

	// Get query entry
	const queryKey = _getQueryKey(domain_id, options);

	// Wait until done loading
	if (_.loading.has(queryKey)) {
		await (new Promise<void>((resolve) => {
			var start_time = Date.now();
			function checkFlag() {
				if (!_.loading.has(queryKey)) {
					resolve();
				} else if (Date.now() > start_time + 3000) {
					resolve();
				} else {
					window.setTimeout(checkFlag, 100);
				}
			}
			checkFlag();
		}));
	}

	// Check if query needs to be refetched
	const queryEntry = _.queries[queryKey];
	let _exists = queryEntry !== undefined;
	let needFetch = _needFetch('', queryEntry, config.app.member.query_interval);

	// Filter results and check for stales if query entry exists
	let filtered: MemberEntry[] = [];
	if (_exists) {
		filtered = _filterEntries(Object.values(_.members[domain_id] || {}), options);

		if (!needFetch) {
			for (const entry of filtered) {
				const fetch = _needFetch('', entry);
				if (fetch) {
					needFetch = fetch;
					break;
				}
			}
		}
	}

	// Refetch if needed
	if (needFetch) {
		_.loading.add(queryKey);

		const results = await api('GET /members', {
			query: {
				domain: domain_id,
				search: options?.search || undefined,
				role: options?.role_id,
				exclude_role: options?.exclude_role_id,
				online: options?.online,
				limit: limit,
				page: options?.page,
				with_data: options?.no_data ? false : undefined,
			},
		}, { session });
		assert(!Array.isArray(results));

		// Save query results
		setMembers(domain_id, results.data);
		_.queries[queryKey] = { time: Date.now(), total: results.count };

		_.loading.delete(queryKey);

		return {
			_exists: true,
			data: results.data,
			count: results.count,
		} as MemberQueryWrapper;
	}

	assert(_exists && queryEntry);
	return {
		_exists: true,
		data: filtered.map(x => x.data),
		count: queryEntry.total,
	} as MemberQueryWrapper;
}


/**
 * Perform a query on local existing member data
 * 
 * @param domain_id The id to query members from
 * @param options Query options
 * @returns A list of members matching the query options
 */
export function listMembersLocal(domain_id: string, options: MemberQueryOptions) {
	return _filterEntries(Object.values(_.members[domain_id] || {}), options).map(x => x.data);
}

/**
 * Get a member from cache, even if the data is stale
 * 
 * @param domain_id The id to fetch member from
 * @param profile_id The profile id of the member
 * @returns The member object
 */
export function getMemberSync(domain_id: string, profile_id: string): ExpandedMember | null {
	return _getMemberEntry(domain_id, profile_id)?.data || null;
}


/**
 * Update members with the given profile id for all domains that are loaded.
 * This function only updates member values locally
 * 
 * @param profile_id The id of the profile
 * @param fn The update function
 * @param emit Indicates if this change should be emitted
 */
export function updateMemberLocal(profile_id: string, fn: (member: ExpandedMember) => ExpandedMember, emit: boolean = true) {
	const cache = { ..._.members };

	for (const [domain_id, members] of Object.entries(cache)) {
		if (!members[profile_id]) continue;

		// Create copy
		const copy = { ...members };
		copy[profile_id] = { ...copy[profile_id], data: fn(copy[profile_id].data) };

		// Set to domain cache
		cache[domain_id] = copy;
	}

	// Set members cache
	_.members = cache;

	if (emit)
		_emitChange();
}

/**
 * Function to update query counts locally
 * 
 * @param filter The function used to determine if the entry should be updated
 * @param fn The query entry update function, should return the new count
 * @param emit Indicates if this change should be emitted
 */
export function updateMemberQueryLocal(filter: (domain_id: string, options: MemberQueryOptions) => boolean, fn: (count: number, domain_id: string, options: MemberQueryOptions) => number, emit: boolean = true) {
	const copy = { ..._.queries };

	for (const [key, entry] of Object.entries(copy)) {
		// Parse key
		const [domain_id, queryStr] = key.split('?');
		const opts = queryStr?.split('&').map(str => str.split('=')) || [];

		// Parse options
		const options: MemberQueryOptions = {};
		for (const opt of opts) {
			if (opt[0] === 'search')
				options.search = opt[1];
			else if (opt[0] === 'role_id')
				options.role_id = opt[1];
			else if (opt[0] === 'exclude_role_id')
				options.exclude_role_id = opt[1];
			else if (opt[0] === 'page')
				options.page = parseInt(opt[1]) || undefined;
			else if (opt[0] === 'online')
				options.online = opt[1] === 'true';
			else if (opt[0] === 'no_data')
				options.no_data = opt[1] === 'true';
		}

		if (filter(domain_id, options))
			copy[key] = { ...entry, total: fn(entry.total, domain_id, options) };
	}

	// Set queries cache
	_.queries = copy;

	if (emit)
		_emitChange();
}