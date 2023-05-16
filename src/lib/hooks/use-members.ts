import useSWR from 'swr';
import assert from 'assert';

import { Member } from '@/lib/types';
import { getMember, listMembers } from '@/lib/db';

import { SwrWrapper, wrapSwrData } from '@/lib/utility/swr-wrapper';

import { useSession } from './use-session';


/** Swr data wrapper for a member object */
export type MemberWrapper<Loaded extends boolean = true> = SwrWrapper<Member, {}, false, Loaded>;

/** Swr data wrapper for a list of members */
export type MemberListWrapper<Loaded extends boolean = true> = SwrWrapper<Member[], {}, true, Loaded>;


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

	return wrapSwrData(response, { session });
}


/**
 * A swr hook that retrieves domain member data.
 * 
 * @param domain_id The id of the domain to retrieve member data from
 * @param search The alias query to use for searching
 * @returns A list of members
 */
export function useMemberQuery(domain_id: string, search: string = '') {
	const session = useSession();
	const response = useSWR<Member[] | null>(
		domain_id && session.token ? `${domain_id}.members:${search}` : null,
		() => listMembers(domain_id, search, session)
	);

	return wrapSwrData<Member[], {}, true>(response, { seperate: true, session });
}