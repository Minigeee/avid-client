
import { KeyedMutator } from 'swr';
import assert from 'assert';

import config from '@/config';
import { SessionContextState } from '@/lib/contexts';
import { query, sql } from '@/lib/db';
import { Domain, ExpandedProfile, Profile } from '@/lib/types';

import { useDbQuery } from './use-db-query';


/**
 * A swr hook that retrieves the current profile.
 * 
 * @param profile_id The id of the domain to retrieve
 * @returns A swr wrapper object containing the requested profile
 */
export function useProfile(profile_id: string) {
	return useDbQuery<ExpandedProfile>(profile_id, (key) => {
		return sql.select([
			'*',
			sql.wrap(sql.select<Domain>(
				['id', 'name'],
				{ from: '->member_of->domains' }
			), { alias: 'domains' }),
		], { from: profile_id });
	}, {
		then: (results) => results?.length ? results[0] : null,
	});
}