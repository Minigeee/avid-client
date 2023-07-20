
import { KeyedMutator } from 'swr';
import { ScopedMutator, cache, useSWRConfig } from 'swr/_internal';
import assert from 'assert';

import { api, deleteDomainImage, uploadDomainImage } from '@/lib/api';
import { SessionState } from '@/lib/contexts';
import { AllPermissions, ChannelData, ChannelOptions, ChannelTypes, ExpandedDomain, ExpandedMember, Role } from '@/lib/types';
import { swrErrorWrapper } from '@/lib/utility/error-handler';

import { useApiQuery } from './use-api-query';
import { SwrWrapper } from './use-swr-wrapper';
import { useSession } from './use-session';
import { setSwrMembers } from './use-members';


////////////////////////////////////////////////////////////
function mutators(mutate: KeyedMutator<ExpandedDomain>, session: SessionState | undefined, _mutate: ScopedMutator) {
	assert(session);

	return {

		/**
		 * Add a new channel to the domain
		 * 
		 * @param name The name of the channel
		 * @param type The channel type
		 * @param group_id The id of the group to create the channel in
		 * @param data Any extra data required to create the specified channel type
		 * @returns The new domain object
		 */
		addChannel: <T extends ChannelTypes>(name: string, type: T, group_id: string, data?: ChannelData<T>, options?: ChannelOptions<T>) => mutate(
			swrErrorWrapper(async (domain: ExpandedDomain) => {
				const channel = await api('POST /channels', {
					body: {
						domain: domain.id,
						group: group_id,
						type,
						name,
						data,
						options,
					},
				}, { session });

				// Update channels
				const channels = {
					...domain.channels,
					[channel.id]: channel,
				};

				// Update groups
				const groups = domain.groups.slice();
				const idx = groups.findIndex(x => x.id === group_id);
				groups[idx] = { ...groups[idx], channels: [...groups[idx].channels, channel.id] };

				return {
					...domain,
					channels,
					groups,
				};
			}, { message: 'An error occurred while creating channel' }),
			{ revalidate: false }
		),

		/**
		 * Rename a channel
		 * 
		 * @param channel_id The id of the channel to remove
		 * @param name The new name to assign the channel
		 * @returns The new domain object
		 */
		renameChannel: (channel_id: string, name: string) => mutate(
			swrErrorWrapper(async (domain: ExpandedDomain) => {
				const results = await api('PATCH /channels/:channel_id', {
					params: { channel_id },
					body: { name },
				}, { session });

				// Replace channel with new object
				const channels = {
					...domain.channels,
					[channel_id]: { ...domain.channels[channel_id], name: results?.name || name },
				};

				return { ...domain, channels };
			}, { message: 'An error occurred while renaming channel' }),
			{
				revalidate: false,
				optimisticData: (domain) => {
					if (!domain) throw new Error('trying to rename channel from domain that is undefined');

					// Replace channel with new object
					const channels = {
						...domain.channels,
						[channel_id]: { ...domain.channels[channel_id], name },
					};
	
					return { ...domain, channels };
				}
			}
		),

		/**
		 * Remove a channel from the domain object
		 * 
		 * @param channel_id The id of the channel to remove
		 * @returns The new domain object
		 */
		removeChannel: (channel_id: string) => mutate(
			swrErrorWrapper(async (domain: ExpandedDomain) => {
				// Delete channel
				await api('DELETE /channels/:channel_id', {
					params: { channel_id },
				}, { session });

				// Update channels list
				const channels = { ...domain.channels };
				delete channels[channel_id];

				// Update groups list
				const groups = domain.groups.map(group => ({ ...group, channels: group.channels.filter(c => c !== channel_id) }));

				return { ...domain, channels, groups };
			}, { message: 'An error occurred while deleting channel' }),
			{
				revalidate: false,
				optimisticData: (domain) => {
					if (!domain) throw new Error('trying to remove channel from domain that is undefined');

					// Update channels list
					const channels = { ...domain.channels };
					delete channels[channel_id];

					// Update groups list
					const groups = domain.groups.map(group => ({ ...group, channels: group.channels.filter(c => c !== channel_id) }));

					return { ...domain, channels, groups };
				}
			}
		),

		/**
		 * Set the order channels appear in this domain.
		 * 
		 * @param channel_id The id of the channel to change order of
		 * @param from.group_id The id of the group the channel originated from
		 * @param from.index The index of the channel within the original group
		 * @param to.group_id The id of the group the channel should move to
		 * @param to.index The index of the channel within the destination group
		 * @returns The new domain object
		 */
		moveChannel: (channel_id: string, from: { group_id: string; index: number }, to: { group_id: string; index: number }) => {
			function modifyGroups(domain: ExpandedDomain) {
				const same = to.group_id === from.group_id;

				// Find the src and dst groups
				const srcIdx = domain.groups.findIndex(x => x.id === from.group_id);
				const dstIdx = same ? srcIdx : domain.groups.findIndex(x => x.id === to.group_id);
				assert(srcIdx >= 0 && dstIdx >= 0);

				// Splice channel arrays
				const srcChannels = domain.groups[srcIdx].channels.slice();
				srcChannels.splice(from.index, 1);
				const dstChannels = same ? srcChannels : domain.groups[dstIdx].channels.slice();
				dstChannels.splice(to.index, 0, channel_id);

				// New groups array
				const groups = domain.groups.slice();
				if (!same)
					groups[srcIdx] = { ...groups[srcIdx], channels: srcChannels };
				groups[dstIdx] = { ...groups[dstIdx], channels: dstChannels };

				return { groups, dstChannels, same };
			}

			return mutate(
				swrErrorWrapper(async (domain: ExpandedDomain) => {
					if (!domain) return;

					// Modify group channels
					const { groups, dstChannels, same } = modifyGroups(domain);

					// Id of the channel before dst index
					const before = to.index === 0 ? null : dstChannels[to.index - 1];

					// Move channel
					await api('PATCH /channels/:channel_id', {
						params: { channel_id },
						body: {
							after: before,
							group: same ? undefined : to.group_id,
						},
					}, { session });

					return { ...domain, groups };
				}, { message: 'An error occurred while changing channel order' }),
				{
					revalidate: false,
					optimisticData: (domain) => {
						assert(domain);

						// Modify group channels
						const { groups } = modifyGroups(domain);

						return { ...domain, groups };
					}
				}
			);
		},

		/**
		 * Add a new channel group to the domain
		 * 
		 * @param name The name of the channel group
		 * @param allow_everyone Should permissions entry be made for everyone
		 * @returns The new domain object
		 */
		addGroup: (name: string, allow_everyone: boolean = true) => mutate(
			swrErrorWrapper(async (domain: ExpandedDomain) => {
				// Create group
				const results = await api('POST /channel_groups', {
					body: {
						domain: domain.id,
						name,
						allow_everyone,
					},
				}, { session });

				// Add to domain
				return {
					...domain,
					groups: [...domain.groups, results],
				};
			}, { message: 'An error occurred while creating channel group' }),
			{ revalidate: false }
		),

		/**
		 * Rename a channel group
		 * 
		 * @param group_id The id of the channel group to rename
		 * @param name The new name to assign the group
		 * @returns The new domain object
		 */
		renameGroup: (group_id: string, name: string) => mutate(
			swrErrorWrapper(async (domain: ExpandedDomain) => {
				// Change name
				await api('PATCH /channel_groups/:group_id', {
					params: { group_id },
					body: { name },
				}, { session });

				// Change group name
				const copy = domain.groups.slice();
				const idx = copy.findIndex(x => x.id === group_id);
				if (idx < 0) return domain;
				copy[idx] = { ...copy[idx], name };

				return {
					...domain,
					groups: copy,
				};

			}, { message: 'An error occurred while renaming channel group' }),
			{
				revalidate: false,
				optimisticData: (domain) => {
					assert(domain);

					// Change group name
					const copy = domain.groups.slice();
					const idx = copy.findIndex(x => x.id === group_id);
					if (idx < 0) return domain;
					copy[idx] = { ...copy[idx], name };

					return {
						...domain,
						groups: copy,
					};
				},
			}
		),

		/**
		 * Remove a group and all its associated channels
		 * 
		 * @param group_id The id of the group to remove
		 * @returns The new domain object
		 */
		removeGroup: (group_id: string) => mutate(
			swrErrorWrapper(async (domain: ExpandedDomain) => {
				// Delete group
				await api('DELETE /channel_groups/:group_id', {
					params: { group_id }
				}, { session });

				// Find group
				const idx = domain.groups.findIndex(x => x.id === group_id);
				if (idx < 0) return domain;
				const group = domain.groups[idx];
				
				// Delete every channel
				const channels = { ...domain.channels };
				for (const channel_id of group.channels)
					// Remove from list
					delete channels[channel_id];

				// Update groups list
				const groups = domain.groups.slice();
				groups.splice(idx, 1);

				return { ...domain, channels, groups };
			}, { message: 'An error occurred while deleting channel group' }),
			{
				revalidate: false,
				optimisticData: (domain) => {
					if (!domain) throw new Error('trying to remove channel from domain that is undefined');

					// Find group
					const idx = domain.groups.findIndex(x => x.id === group_id);
					if (idx < 0) return domain;
					const group = domain.groups[idx];

					// Update channels list
					const channels = { ...domain.channels };
					for (const channel_id of group.channels)
						delete channels[channel_id];

					// Update groups list
					const groups = domain.groups.slice();
					groups.splice(idx, 1);

					return { ...domain, channels, groups };
				}
			}
		),

		/**
		 * Change the order of channel groups within a domain
		 * 
		 * @param from The starting index of the channel group
		 * @param to The ending index of the channel group
		 * @returns The new domain object
		 */
		moveGroup: (from: number, to: number) => mutate(
			swrErrorWrapper(async (domain: ExpandedDomain) => {
				// Make updated (local) list
				const copy = domain.groups.slice();
				const group = copy[from];
				copy.splice(from, 1);
				copy.splice(to, 0, group);

				// The element before the dst
				const before = to === 0 ? null : copy[to - 1].id;
				// The group being moved
				const group_id = group.id.split(':')[1];

				// Move group
				await api('PATCH /channel_groups/:group_id', {
					params: { group_id },
					body: { after: before },
				}, { session });

				return { ...domain, groups: copy };

			}, { message: 'An error occurred while moving channel group' }),
			{
				revalidate: false,
				optimisticData: (domain) => {
					assert(domain);

					const copy = domain.groups.slice();
					const group = copy[from];
					copy.splice(from, 1);
					copy.splice(to, 0, group);

					return { ...domain, groups: copy };
				},
			}
		),

		/**
		 * Upload and set the specified image as the domain icon picture.
		 * 
		 * @param image The image data to set as domain icon
		 * @param fname The name of the original image file
		 * @returns The new domain object
		 */
		setIcon: (image: Blob, fname: string) => mutate(
			swrErrorWrapper(async (domain: ExpandedDomain) => {
				// Upload profile image
				const url = await uploadDomainImage(domain.id, 'icon', image, fname, session);

				return {
					...domain,
					icon: url,
				};
			}, { message: 'An error occurred while setting domain icon picture' }),
			{ revalidate: false }
		),

		/**
		 * Remove the current domain icon picture. Performs optimistic update.
		 * 
		 * @returns The new domain object
		 */
		removeIcon: () => mutate(
			swrErrorWrapper(async (domain: ExpandedDomain) => {
				// Delete profile image
				await deleteDomainImage(domain, 'icon', session);

				return {
					...domain,
					icon: null,
				};
			}, { message: 'An error occurred while removing domain icon picture' }),
			{
				revalidate: false,
				optimisticData: (domain) => {
					assert(domain);
					return {
						...domain,
						icon: null,
					};
				}
			}
		),
		
		/**
		 * Create a new role
		 * 
		 * @param label The initial label to assign the role
		 * @returns The new domain object
		 */
		addRole: (label?: string) => mutate(
			swrErrorWrapper(async (domain: ExpandedDomain) => {
				const results = await api('POST /roles', {
					body: { domain: domain.id, label: label || 'New Role' },
				}, { session });

				return { ...domain, roles: [...domain.roles, results] };
			}, { message: 'An error occurred while adding role to domain' }),
			{ revalidate: false }
		),

		/**
		 * Perform a batch of role operations
		 * 
		 * @param options Role update options
		 * @param options.changed A map of role ids to new roles to be merged into existing ones
		 * @param options.order A list of role ids in the order they should appear
		 * @returns The new domain object
		 */
		updateRoles: (options: { changed?: Record<string, Partial<Role>>; order?: string[]; }) => mutate(
			swrErrorWrapper(async (domain: ExpandedDomain) => {
				let copy = domain.roles.slice();
				console.log(options)

				// Change
				if (options.changed && Object.keys(options.changed).length > 0) {
					// Update all roles
					const results = await api('PATCH /roles', {
						body: {
							roles: Object.entries(options.changed).map(([id, role]) => ({ ...role, id })),
						},
					}, { session });

					// Update roles locally
					const map: Record<string, Role> = {};
					for (const role of results)
						map[role.id] = role;

					for (let i = 0; i < copy.length; ++i) {
						if (map[copy[i].id])
							copy[i] = map[copy[i].id];
					}
				}

				// Order (every domain member has access to view all roles, so direct array set can be used)
				if (options.order) {
					const results = await api('PUT /domains/:domain_id/role_order', {
						params: { domain_id: domain.id },
						body: { roles: options.order },
					}, { session });

					// Rearrange roles
					const map: Record<string, Role> = {};
					for (const role of copy)
						map[role.id] = role;

					copy = results.roles.map(id => map[id]);
				}

				return {
					...domain,
					roles: copy,
				};
			}, { message: 'An error occurred while updating roles' }),
			{ revalidate: false }
		),

		/**
		 * Delete a role from this domain. This will also remove the specified role
		 * from every member that has the role.
		 * 
		 * @param role_id The id of the role to delete
		 * @returns The new domain object
		 */
		deleteRole: (role_id: string) => mutate(
			swrErrorWrapper(async (domain: ExpandedDomain) => {
				// Delete role
				await api('DELETE /roles/:role_id', { params: { role_id } }, { session });

				// Get a list of members to update
				const updated: ExpandedMember[] = [];
				for (const key of Array.from(cache.keys())) {
					if (key.startsWith(`${domain.id}.profiles:`)) {
						const member = cache.get(key)?.data as ExpandedMember;
						const idx = member?.roles?.findIndex(r => r === role_id);

						if (idx !== undefined && idx >= 0) {
							const copy = member.roles?.slice() || [];
							copy.splice(idx);
							updated.push({ ...member, roles: copy });
						}
					}
				}

				// Update members
				setSwrMembers(domain.id, updated, undefined, _mutate);

				// Update domain object
				return { ...domain, roles: domain.roles.filter(r => r.id !== role_id) };
			}, { message: 'An error occurred while deleting role' }),
			{ revalidate: false }
		),
	};
}


/** Mutators that will be attached to the domain swr wrapper */
export type DomainMutators = ReturnType<typeof mutators>;
/** Swr data wrapper for a domain object */
export type DomainWrapper<Loaded extends boolean = true> = SwrWrapper<ExpandedDomain, Loaded, DomainMutators>;


/**
 * A swr hook that performs an api query to retrieve a domain.
 * 
 * @param domain_id The id of the domain to retrieve
 * @returns A swr wrapper object containing the requested domain
 */
export function useDomain(domain_id: string | undefined) {
	const session = useSession();
	const { mutate } = useSWRConfig();

	return useApiQuery(domain_id, 'GET /domains/:domain_id', {
		params: { domain_id: domain_id || '' }
	}, {
		then: (results) => {
			for (const [resource, perms] of Object.entries(results._permissions.permissions))
				results._permissions.permissions[resource] = new Set(perms);
			return results;
		},
		mutators,
		mutatorParams: [mutate],
	});
}


/** Check if user has a certain permission */
export function hasPermission(domain: DomainWrapper, resource: string, permission: AllPermissions) {
	let resource_id = resource.startsWith('channels') ? (domain.channels[resource].inherit || resource) : (cache.get(resource)?.data?.inherit || resource);
	// console.log(resource, resource_id, permission, domain._permissions.permissions)
	return domain._permissions.is_admin || domain._permissions.permissions[resource_id]?.has(permission);
}

/** Check if user has a certain acl entry */
export function hasEntry(domain: DomainWrapper, resource: string, role: string) {
	let resource_id = resource.startsWith('channels') ? (domain.channels[resource].inherit || resource) : (cache.get(resource)?.data?.inherit || resource);
	// console.log(resource, resource_id, permission, domain._permissions.permissions)
	return domain._permissions.is_admin || domain._permissions.entries.findIndex(x => x.resource === resource_id && x.role === role) >= 0;
}

/**
 * Checks if user can set permissions for an acl entry
 * 
 * @param domain The domain wrapper used to get user permissions
 * @param resource The resource for the permission being set
 * @param role The role for the permission being set
 * @returns True or false
 */
export function canSetPermissions(domain: DomainWrapper, entry: { resource: string, role: string }) {
	const { resource, role } = entry;
	let resource_id = resource.startsWith('channels') ? (domain.channels[resource].inherit || resource) : (cache.get(resource)?.data?.inherit || resource);
	// User can be admin, or they have to be able to manage resource and manage permissions for the role
	return domain._permissions.is_admin || (domain._permissions.permissions[resource_id]?.has('can_manage') && domain._permissions.permissions[role]?.has('can_manage_permissions'));
}