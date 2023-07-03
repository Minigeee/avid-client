import useSWR, { KeyedMutator, useSWRConfig } from 'swr';
import assert from 'assert';

import { ExpandedMember, Member } from '@/lib/types';
import { SessionState } from '@/lib/contexts';
import { MemberListOptions, MemberListResults, getDomainCache, getMember, getMemberQueries, getMemberQueryKey, listMembers, query, sql } from '@/lib/db';

import { useSession } from './use-session';
import { SwrWrapper, useSwrWrapper } from './use-swr-wrapper';
import { swrErrorWrapper } from '../utility/error-handler';
import { ScopedMutator } from 'swr/_internal';


/** Swr data wrapper for a member object */
export type MemberWrapper<Loaded extends boolean = true> = SwrWrapper<Member, Loaded>;


/**
 * A swr hook that retrieves domain member data.
 * 
 * @param domain_id The id of the domain to retrieve member data from
 * @param member_id The id of the member to retrieve data
 * @returns Member data
 */
export function useMember(domain_id: string, member_id: string) {
	const session = useSession();
	const response = useSWR<Member | null>(
		domain_id && member_id && session.token ? `${domain_id}.${member_id}` : null,
		() => getMember(domain_id, member_id, session)
	);

	return useSwrWrapper<Member>(response, { session });
}


////////////////////////////////////////////////////////////
function _modifyListQuery(newMembers: ExpandedMember[], options: MemberListOptions, list: MemberListResults) {
	// Return modified list
	const copy = list.data.slice();
	let count = list.count || 0;

	for (const member of newMembers) {
		const idx = copy.findIndex(x => x.id === member.id);
		if (idx < 0) {
			copy.push(member);
			count += 1;
		}
	
		else if (options.role_id) {
			// Remove member from list if the role was removed
			if (member.roles && member.roles.findIndex(x => options.role_id === x) < 0) {
				copy.splice(idx, 1);
				count -= 1;
			}
		}
		else {
			copy[idx] = member;
		}
	}

	return { data: copy, count: Math.max(count, 0) };
}

////////////////////////////////////////////////////////////
async function _applyMember(domain_id: string, members: Record<string, Partial<Member>>, options: MemberListOptions, list: MemberListResults, session: SessionState, _mutate: ScopedMutator) {
	// Get cache
	const cache = await getDomainCache(domain_id, session);

	// Map of merged member objects
	const merged: Record<string, ExpandedMember> = {};
	for (const [id, member] of Object.entries(members))
		merged[id] = { ...(await cache.cache.get(id, false)), ...member };

	// Apply merged member objects
	for (const [id, member] of Object.entries(merged)) {
		// Add to cache
		const cached = cache.cache._data[id].data;
		if (cached) {
			const newMember = members[id];
			for (const [k, v] of Object.entries(newMember))
				// @ts-ignore
				cached[k] = v;
		}

		// Apply changes to individual hooks
		_mutate(`${domain_id}.${id}`, member, { revalidate: false });
	}

	// Create new list
	list = _modifyListQuery(Object.values(merged), options, list);

	// Apply new query count
	const queries = getMemberQueries(domain_id);
	const key = getMemberQueryKey(options);
	queries[key].count = list.count;

	return list;
}

////////////////////////////////////////////////////////////
function queryMutators(mutate: KeyedMutator<MemberListResults>, session: SessionState | undefined, domain_id: string, options: MemberListOptions, _mutate: ScopedMutator) {
	assert(session);

	return {
		/**
		 * Add a role to many members
		 * 
		 * @param profile_ids A list of profile ids for members to add the role to
		 * @param role_id The id of the role to add to the member
		 * @returns The new member query data
		 */
		addRoles: (profile_ids: string[], role_id: string) => mutate(
			swrErrorWrapper(async (members) => {
				// Modify data
				const results = await query<Member[]>(
					sql.update<Member>(`${domain_id}<-member_of`, {
						where: sql.match({ in: ['IN', profile_ids] }),
						set: { roles: ['+=', role_id] },
						return: ['roles']
					}),
					{ session }
				);
				assert(results && results.length === profile_ids.length);

				const map: Record<string, Partial<Member>> = {};
				for (let i = 0; i < profile_ids.length; ++i)
					map[profile_ids[i]] = results[i];

				return await _applyMember(domain_id, map, options, members, session, _mutate);
			}, { message: 'An error occurred while adding role to member' }),
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
			swrErrorWrapper(async (members) => {
				// Modify data
				const results = await query<Member[]>(
					sql.update<Member>(`${domain_id}<-member_of`, {
						where: sql.match({ in: profile_id }),
						set: { roles: ['-=', role_id] },
						return: ['roles']
					}),
					{ session }
				);
				assert(results && results.length > 0);

				return await _applyMember(domain_id, { [profile_id]: results[0] }, options, members, session, _mutate);
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

					const list = _modifyListQuery([{ ...member, roles }], options, members);
					return list;
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

	// Create query string
	const constraints: string[] = [];

	if (options.search)
		constraints.push(`search=${options.search.toLocaleLowerCase()}`);
	if (options.role_id)
		constraints.push(`role=${options.role_id}`);
	if (options.limit !== undefined)
		constraints.push(`limit=${options.limit}`);
	if (options.page !== undefined)
		constraints.push(`page=${options.page}`);

	// Check when this query was last performed
	const queryKey = `${domain_id}.members${constraints.length ? '?' + constraints.join('&') : ''}`;

	const session = useSession();
	const response = useSWR<MemberListResults | null>(
		domain_id && session.token ? queryKey : null,
		() => listMembers(domain_id, options, session)
	);

	return useSwrWrapper<MemberListResults, MemberListMutators>(response, {
		session,
		mutators: queryMutators,
		mutatorParams: [domain_id, options, mutate],
	});
}