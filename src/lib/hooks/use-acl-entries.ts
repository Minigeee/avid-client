import { KeyedMutator, useSWRConfig, mutate as globalMutate } from 'swr';
import { ScopedMutator } from 'swr/_internal';
import assert from 'assert';

import { api } from '@/lib/api';
import { SessionState } from '@/lib/contexts';
import { AclEntry } from '@/lib/types';
import { errorHandler } from '@/lib/utility/error-handler';

import { useApiQuery } from './use-api-query';
import { SwrWrapper } from './use-swr-wrapper';


/** Acl entries wrapper */
export type AclEntriesWrapper<Loaded extends boolean = true> = SwrWrapper<AclEntry[], Loaded>;


/**
 * Get a list of ACL entries for all roles with a given resource
 * 
 * @param resource_id The id of the resource to retrieve ACL entries for
 * @returns A swr wrapper with a list of ACL entries
 */
export function useAclEntries(resource_id: string | undefined) {
	return useApiQuery(resource_id ? `acl.by_resource.${resource_id}` : undefined, 'GET /permissions', {
		query: { resource: resource_id, resource_type: resource_id?.split(':')[0] },
	}, {});
}


/**
 * Get a list of ACL entries for all resources with a given role
 * 
 * @param role_id The id of the role to retrieve ACL entries for
 * @returns A swr wrapper with a list of ACL entries
 */
export function useAclEntriesByRole(role_id: string | undefined) {
	return useApiQuery(role_id ? `acl.by_role.${role_id}` : undefined, 'GET /permissions', {
		query: { role: role_id },
	}, {});
}


/**
 * Set acl entries for a domain
 * 
 * @param domain_id The domain to set acl entries for
 * @param entries A list of entries with new permissions lists
 * @param session Session object used to authenticate api call
 * @param _mutate Global mutation function to keep local state synced
 */
export async function setAclEntries(domain_id: string, entries: (Omit<AclEntry, 'domain'> & { domain?: string })[], session: SessionState, _mutate: ScopedMutator) {
	try {
		// Patch permissions
		const { updated, deleted } = await api('PATCH /permissions', {
			body: {
				domain: domain_id,
				permissions: entries,
			}
		}, { session });

		// Sets and maps
		const hookSet = new Set<string>();
		const newMap: Record<string, AclEntry | null> = {};

		for (const entry of updated) {
			hookSet.add(`acl.by_resource.${entry.resource}`);
			hookSet.add(`acl.by_role.${entry.role}`);

			newMap[`${entry.resource}.${entry.role}`] = entry;
		}

		for (const entry of deleted) {
			hookSet.add(`acl.by_resource.${entry.resource}`);
			hookSet.add(`acl.by_role.${entry.role}`);

			newMap[`${entry.resource}.${entry.role}`] = null;
		}

		// Update all entries locally
		for (const key of Array.from(hookSet)) {
			// Track the resource/role grouping this set is
			const [_, type, group] = key.split('.');

			// The list of entries that should be updated
			const unaccounted = new Set<string>(Object.keys(newMap).filter(x => {
				const [resource, role] = x.split('.');
				return (type === 'by_resource' && resource === group) || (type === 'by_role' && role === group);
			}));

			_mutate(
				key, (data: AclEntry[] | undefined) => {
					if (!data) return data;
					assert(Array.isArray(data));
	
					const copy = data.slice();
					for (let i = 0; i < copy.length; ++i) {
						const entry = copy[i];
						const entryKey = `${entry.resource}.${entry.role}`;
						const newVal = newMap[entryKey];

						if (newVal === undefined) continue;
	
						if (newVal === null) {
							copy.splice(i, 1);
							--i;
						}
						else {
							copy[i] = newVal;
						}

						// Mark this entry as accounted for
						unaccounted.delete(entryKey);
					}

					// Push unaccounted
					for (const entryKey of Array.from(unaccounted)) {
						const entry = newMap[entryKey];
						if (entry)
							copy.push(entry);
					}
	
					return copy;
				},
				{ revalidate: false }
			);
		}
	}
	catch (err) {
		errorHandler(err, { message: 'An error occurred while updating permissions' });
	}
}