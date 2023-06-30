import { KeyedMutator, useSWRConfig } from 'swr';
import { ScopedMutator } from 'swr/_internal';
import assert from 'assert';

import { deleteDomainImage, uploadDomainImage } from '@/lib/api';
import { SessionState } from '@/lib/contexts';
import { addChannel, query, removeChannel, sql } from '@/lib/db';
import { AclEntry, AllPermissions, Channel, ChannelData, ChannelOptions, ChannelTypes, Domain, ExpandedDomain, Member, Role, UserPermissions } from '@/lib/types';
import { swrErrorWrapper } from '@/lib/utility/error-handler';

import { useDbQuery } from './use-db-query';
import { SwrWrapper } from './use-swr-wrapper';
import { useSession } from './use-session';


////////////////////////////////////////////////////////////
function mutators(mutate: KeyedMutator<AclEntry[]>, session: SessionState, resource_id: string, _mutate: ScopedMutator) {
	return {
		/**
		 * Set the permissions list for an entry with the given role
		 * 
		 * @param role_id The id of the role for entries to modify
		 * @param permissions The new (complete) list of permissions to set in the entry
		 * @returns The new list of acl entries
		 */
		setPermissions: (permissions: Record<string, AllPermissions[]>) => mutate(
			swrErrorWrapper(async (entries: AclEntry[]) => {
				const operations: string[] = [];
				const updated: Partial<AclEntry>[] = [];

				// Add operations
				let hasUpdateStatements = false;
				for (const [role_id, perms] of Object.entries(permissions)) {
					if (perms.length > 0) {
						operations.push(
							sql.if({
								cond: `$entries CONTAINS ${role_id}`,
								body: sql.update<AclEntry>('acl', {
									set: { permissions: perms },
									where: sql.match<AclEntry>({ resource: resource_id, role: role_id }),
									return: 'AFTER',
								}),
							}, {
								body: sql.create<AclEntry>('acl', {
									domain: sql.$(`${role_id}.domain`),
									resource: resource_id,
									role: role_id,
									permissions: perms,
								}),
							})
						);

						hasUpdateStatements = true;
					}
					else {
						operations.push(
							sql.delete<AclEntry>('acl', {
								where: sql.match<AclEntry>({ resource: resource_id, role: role_id }),
							})
						);
					}

					// Track entries that are updated
					const entry = entries.find(x => x.role === role_id);
					updated.push({
						...(entry || {
							resource: resource_id,
							role: role_id,
						}),
						permissions: perms,
					});
				}

				// Add select for entries that point to given resource
				if (hasUpdateStatements) {
					operations.splice(0, 0,
						sql.let('$entries', sql.wrap(sql.select<AclEntry>(['role'], {
							from: 'acl',
							where: sql.match<AclEntry>({ resource: resource_id }),
						}), { append: '.role' }))
					);
				}

				// Refetch
				operations.push(sql.select<AclEntry>('*', {
					from: 'acl',
					where: sql.match<AclEntry>({ resource: resource_id }),
				}));

				// Perform query
				const results = await query<(AclEntry | AclEntry[] | null)[]>(sql.transaction(operations), { session, complete: true });
				assert(results);
				const offset = hasUpdateStatements ? 1 : 0;

				// Update data
				const copy = entries.slice();
				for (let i = 0; i < updated.length; ++i) {
					const entry = updated[i];
					// These should be present by default
					assert(entry.role && entry.resource && entry.permissions);

					// Check what type of operation was performed
					const result = results[offset + i];
					const updatedEntry = Array.isArray(result) ? result[0] : result;

					// Update resource based data
					const idx = copy.findIndex(x => x.role === entry.role);
					if (idx < 0 && updatedEntry)
						copy.push(updatedEntry);
					else {
						if (updatedEntry)
							copy[idx] = updatedEntry;
						else
							copy.splice(idx, 1);
					}

					// Update role based data
					_mutate<AclEntry[]>(`${entry.role}.acl_roles`, async (entries) => {
						if (!entries) return;
						
						const copy = entries.slice();

						// Find entries with matching resource
						const idx = copy.findIndex(entry => entry.resource === resource_id);
						if (idx < 0 && updatedEntry)
							copy.push(updatedEntry);
						else {
							if (updatedEntry)
								copy[idx] = updatedEntry;
							else
								copy.splice(idx, 1);
						}

						return copy;
					}, { revalidate: false });
				}

				console.log(copy)
				return copy;
			}, { message: 'An error occurred while setting permissions' }),
			{ revalidate: false }
		),
	};
}


/** Mutators that will be attached to the acl entries swr wrapper */
export type AclEntriesMutators = ReturnType<typeof mutators>;
/** Swr data wrapper for acl entries */
export type AclEntriesWrapper<Loaded extends boolean = true> = SwrWrapper<AclEntry[], Loaded, AclEntriesMutators>;
/** Swr data wrapper for acl entries */
export type AclEntriesWrapperNoMutators<Loaded extends boolean = true> = SwrWrapper<AclEntry[], Loaded>;


/**
 * Get a list of ACL entries for the given resource
 * 
 * @param resource_id The id of the resource to retrieve ACL entries for
 * @returns A swr wrapper with a list of ACL entries
 */
export function useAclEntries(resource_id: string | undefined) {
	const { mutate } = useSWRConfig();

	return useDbQuery<AclEntry[], AclEntriesMutators>(resource_id ? `${resource_id}.acl` : undefined, {
		builder: (key) => sql.select<AclEntry>('*', {
			from: 'acl',
			where: sql.match<AclEntry>({ resource: resource_id }),
		}),
		mutators,
		mutatorParams: [resource_id, mutate],
	});
}

/**
 * Get a list of ACL entries for all resources with a given role
 * 
 * @param role_id The id of the role to retrieve ACL entries for
 * @returns A swr wrapper with a list of ACL entries
 */
export function useAclEntriesByRole(role_id: string | undefined) {
	return useDbQuery<AclEntry[]>(role_id ? `${role_id}.acl_roles` : undefined, {
		builder: (key) => sql.select<AclEntry>('*', {
			from: 'acl',
			where: sql.match<AclEntry>({ role: role_id }),
		}),
	});
}