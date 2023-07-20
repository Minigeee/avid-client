import useSWR, { KeyedMutator, useSWRConfig } from 'swr';
import { cache, mutate as _mutate, ScopedMutator } from 'swr/_internal';
import assert from 'assert';

import config from '@/config';
import { api } from '@/lib/api';
import { ExpandedMember, Member } from '@/lib/types';
import { SessionState } from '@/lib/contexts';

import { useSession } from './use-session';
import { SwrWrapper, useSwrWrapper } from './use-swr-wrapper';
import { swrErrorWrapper } from '../utility/error-handler';
import { Mutex } from 'async-mutex';


/** Mutex used to access caches */
const _mutex = new Mutex();

/** Member dedupe interval in seconds */
const DEDUPE_INTERVAL = 10 * 60;


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


/** Swr data wrapper for a member object */
export type MemberWrapper<Loaded extends boolean = true> = SwrWrapper<ExpandedMember, Loaded>;

/**
 * A swr hook that retrieves domain member data.
 * 
 * @param domain_id The id of the domain to retrieve member data from
 * @param member_id The id of the member to retrieve data
 * @returns Member data
 */
export function useMember(domain_id: string, member_id: string) {
	const session = useSession();
	const response = useSWR<ExpandedMember | null>(
		domain_id && member_id && session.token ? `${domain_id}.${member_id}` : null,
		async () => {
			// Get member if no cached
			const member = await api('GET /members/:member_id', {
				params: { member_id },
				query: { domain: domain_id },
			}, { session });
		
			// Store in swr
			setSwrMembers(domain_id, [member], `${domain_id}.${member_id}`, _mutate);

			return member;
		},
		{ dedupingInterval: DEDUPE_INTERVAL * 1000 }
	);

	return useSwrWrapper<Member>(response, { session });
}




/** Create query key from the given options */
function getMemberQueryKey(options: MemberListOptions) {
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

/** Filter members */
function filterMembers(members: ExpandedMember[], options: MemberListOptions) {
	const search = options.search?.toLocaleLowerCase();
	return members.filter(m => {
		return (!search || m.alias.toLocaleLowerCase().indexOf(search) >= 0) && (!options.role_id || m.roles && m.roles?.indexOf(options.role_id) >= 0) && (!options.exclude_role_id || !m.roles || m.roles.indexOf(options.exclude_role_id) < 0);
	}).sort((a, b) => a.alias.localeCompare(b.alias));
}


////////////////////////////////////////////////////////////
function queryMutators(mutate: KeyedMutator<MemberListResults>, session: SessionState | undefined, domain_id: string, options: MemberListOptions, _mutate: ScopedMutator) {
	assert(session);
	
	// Create query key
	const qkey = getMemberQueryKey(options);
	const queryKey = `${domain_id}.members${qkey ? '?' + qkey : ''}`;

	return {
		/**
		 * Add a role to many members
		 * 
		 * @param profile_ids A list of profile ids for members to add the role to
		 * @param role_id The id of the role to add to the member
		 * @returns The new member query data
		 */
		addRoles: (profile_ids: string[], role_id: string) => mutate(
			swrErrorWrapper(async (members: MemberListResults) => {
				// Add role to members
				const results = await api('PATCH /roles/:role_id/members', {
					params: { role_id },
					body: { members: profile_ids },
				}, { session });
				assert(results.length === profile_ids.length);

				const map: Record<string, ExpandedMember> = {};
				for (let i = 0; i < profile_ids.length; ++i)
					map[results[i].id] = results[i];

				// Replace members with new
				const copy = members.data.map(m => {
					const updated = map[m.id];
					if (updated)
						delete map[m.id];

					return updated || m;
				});

				// Create new filtered list
				const filtered = filterMembers(copy.concat(Object.values(map)), options);
				const countDiff = options.role_id || options.exclude_role_id ? filtered.length - members.data.length : 0;

				// Apply these changes to other hooks
				await setSwrMembers(domain_id, results, queryKey, _mutate);

				return {
					data: options.limit !== undefined ? filtered.slice(0, options.limit) : filtered,
					count: (members.count || 0) + countDiff,
				};
			}, { message: 'An error occurred while adding role to members' }),
			{ revalidate: false }
		),

		/**
		 * Remove a role from a member
		 * 
		 * @param profile_id The profile id of the member
		 * @param role_id The id of the role to remove
		 * @returns The new member query data
		 */
		removeRole: (profile_id: string, role_id: string) => mutate(
			swrErrorWrapper(async (members: MemberListResults) => {
				const results = await api('DELETE /members/:member_id/roles/:role_id', {
					params: { member_id: profile_id, role_id },
					query: { domain: domain_id },
				}, { session });

				// Create new member
				const idx = members.data.findIndex(x => x.id === profile_id);
				const newMember = idx >= 0 ? { ...members.data[idx], roles: results } : null;
				if (!newMember) return members;

				// Apply new member
				await setSwrMembers(domain_id, [newMember], queryKey, _mutate);

				const copy = members.data.slice();
				copy[idx] = newMember;

				// Create new filtered list
				const filtered = filterMembers(copy.concat([newMember]), options);
				const countDiff = options.role_id || options.exclude_role_id ? filtered.length - members.data.length : 0;

				return {
					data: options.limit !== undefined ? filtered.slice(0, options.limit) : filtered,
					count: (members.count || 0) + countDiff,
				};
			}, { message: 'An error occurred while removing role from member' }),
			{
				revalidate: false,
				optimisticData: (members) => {
					assert(members);

					// Find member
					const idx = members.data.findIndex(x => x.id === profile_id);
					if (idx < 0) return members;

					// Find role
					const member = members.data[idx];
					const roleIdx = (member.roles || []).findIndex(x => x === role_id);
					if (roleIdx < 0) return members;

					// New roles array
					const roles = member.roles?.slice() || [];
					roles.splice(roleIdx, 1);

					const list = idx >= 0 ? members.data.slice() : members.data;
					if (idx >= 0)
						list[idx] = { ...member, roles };

					return { ...members, data: list };
				}
			}
		),
	};
}

/** Mutators that will be attached to the member query swr wrapper */
export type MemberListMutators = ReturnType<typeof queryMutators>;
/** Swr data wrapper for a list of members */
export type MemberListWrapper<Loaded extends boolean = true> = SwrWrapper<MemberListResults, Loaded, MemberListMutators>;


/**
 * A swr hook that retrieves domain member data.
 * 
 * @param domain_id The id of the domain to retrieve member data from
 * @param options Member list options
 * @returns A list of members
 */
export function useMemberQuery(domain_id: string, options: MemberListOptions) {
	const { mutate } = useSWRConfig();

	// Create query key
	const qkey = getMemberQueryKey(options);
	const queryKey = `${domain_id}.members${qkey ? '?' + qkey : ''}`;

	const session = useSession();
	const response = useSWR<MemberListResults | null>(
		domain_id && session.token ? queryKey : null,
		async () => {
			const limit = Math.min(options.limit || config.app.member.query_limit, 1000);

			// Api member query
			const results = await api('GET /members', {
				query: {
					domain: domain_id,
					search: options.search,
					page: options.page,
					limit: limit,
					role: options.role_id,
					exclude_role: options.exclude_role_id,
				},
			}, { session });
			assert(!Array.isArray(results));

			// Update other hooks
			setSwrMembers(domain_id, results.data, queryKey, mutate);

			return results;
		},
		{ dedupingInterval: DEDUPE_INTERVAL * 1000 }
	);

	return useSwrWrapper<MemberListResults, MemberListMutators>(response, {
		session,
		mutators: queryMutators,
		mutatorParams: [domain_id, options, mutate],
	});
}


/**
 * Get a member from a domain. The local cache is first checked
 * and if valid data exists, it is used. Otherwise, the data is fetched
 * from the api server.
 * 
 * @param domain_id The id of the domain to retrieve the member from
 * @param member_id The id of the member to retrieve
 */
export async function getMember(domain_id: string, member_id: string, session: SessionState): Promise<ExpandedMember> {
	const release = await _mutex.acquire();

	try {
		const cached = cache.get(`${domain_id}.${member_id}`);
		if (cached?.data !== undefined) return cached.data;

		// Get member if no cached
		const member = await api('GET /members/:member_id', {
			params: { member_id },
			query: { domain: domain_id },
		}, { session });

		// Store in swr
		setSwrMembers(domain_id, [member], undefined, _mutate);

		return member;
	}
	finally {
		release();
	}
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

	const release = await _mutex.acquire();

	try {
		// Track if any members are missing from cache
		let missing = false;

		const cached: ExpandedMember[] = [];
		for (const id of member_ids) {
			const obj = cache.get(`${domain_id}.${id}`);
			if (obj?.data === undefined) {
				missing = true;
				break;
			}

			cached.push(obj.data);
		}

		// Return cached if none missing
		if (!missing) return cached;

		// Get member if missing
		const members = await api('GET /members', {
			query: {
				domain: domain_id,
				ids: member_ids,
			},
		}, { session });
		assert(Array.isArray(members));

		// Store in swr
		setSwrMembers(domain_id, members, undefined, _mutate);

		return members;
	}
	finally {
		release();
	}
}

/**
 * Get members from a domain that match the specified query. The local cache is first checked
 * and if valid data exists, it is used. Otherwise, the data is fetched
 * from the api server.
 * 
 * @param domain_id The id of the domain to retrieve the member from
 * @param substr The alias query to use for searching
 */
export async function listMembers(domain_id: string, options: MemberListOptions, session: SessionState): Promise<MemberListResults> {
	const release = await _mutex.acquire();

	try {
		// Create query key
		const qkey = getMemberQueryKey(options);
		const queryKey = `${domain_id}.members${qkey ? '?' + qkey : ''}`;

		// Get cached query
		const cached = cache.get(queryKey);
		if (cached?.data !== undefined) return cached.data;

		// Perform query
		const limit = Math.min(options.limit || config.app.member.query_limit, 1000);
		const results = await api('GET /members', {
			query: {
				domain: domain_id,
				search: options.search,
				page: options.page,
				limit: limit,
				role: options.role_id,
				exclude_role: options.exclude_role_id,
			},
		}, { session });
		assert(!Array.isArray(results));

		// Store in swr
		setSwrMembers(domain_id, results.data, undefined, _mutate);
		// Set query hook
		_mutate(queryKey, results, { revalidate: false });

		return results;
	}
	finally {
		release();
	}
}

/**
 * A synchronous alternative to member fetching. If the data does not
 * exist, null will be returned. After returning existing data, new data will be
 * fetched if no data exists or existing data is stale.
 * Any data that is returned may be stale.
 * 
 * @param domain_id The id of the domain to retrieve the member from
 * @param member_id The id of the member to retrieve
 * @returns The member if it exists, otherwise null
 */
export function getMemberSync(domain_id: string, member_id: string) {
	const cached = cache.get(`${domain_id}.${member_id}`);
	return cached?.data === undefined ? null : cached.data as ExpandedMember;
}


/**
 * Set member values in member swr hooks. This is used to update
 * swr data when it has changed without using the swr hook mutator functions.
 * 
 * @param domain_id The domain of the members
 * @param members The list of new member objects
 * @param exclude_key The key to exclude when setting members
 * @param mutate A global mutator
 */
export async function setSwrMembers(domain_id: string, members: ExpandedMember[], exclude_key: string | undefined, mutate: ScopedMutator) {
	// Map id to object
	const memberMap: Record<string, ExpandedMember> = {};
	
	// Set individual hooks
	const promises: Promise<ExpandedMember | undefined>[] = [];
	for (const member of Object.values(members)) {
		const key = `${domain_id}.${member.id}`;
		promises.push(mutate(key !== exclude_key ? key : undefined, member, { revalidate: false }));

		memberMap[member.id] = member;
	}
	await Promise.all(promises);

	// Set list queries
	await mutate<{ data: ExpandedMember[] }>(
		(key) => {
			const pass = typeof key === 'string' && key.startsWith(`${domain_id}.members`) && key !== exclude_key;
			return pass;
		},
		(data) => {
			if (!data) return data;

			// Members array
			const members = data.data;

			let replaced = false;
			const copy = members.map(m => {
				const replace = memberMap[m.id];
				if (replace)
					replaced = true;

				return replace || m;
			});

			// Only return new copy if replaced
			return !replaced ? data : { data: copy };
		},
		{ revalidate: false }
	);
}