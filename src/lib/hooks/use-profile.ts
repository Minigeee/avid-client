
import { sql } from '@/lib/db';
import { Domain, ExpandedProfile } from '@/lib/types';

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
				['id', 'name', 'time_created'],
				{ from: '->member_of->domains' }
			), { alias: 'domains' }),
		], { from: profile_id });
	}, {
		then: (results) => results?.length ? {
			...results[0],
			// TODO : Make domains draggable
			domains: results[0].domains.sort((a: Domain, b: Domain) => new Date(a.time_created).getTime() - new Date(b.time_created).getTime()),
		 } : null,
	});
}