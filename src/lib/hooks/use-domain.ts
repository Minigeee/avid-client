
import { KeyedMutator } from 'swr';
import { cache } from 'swr/_internal';
import assert from 'assert';

import { deleteDomainImage, uploadDomainImage } from '@/lib/api';
import { SessionState } from '@/lib/contexts';
import { addChannel, new_Record, query, removeChannel, sql } from '@/lib/db';
import { AclEntry, AllPermissions, Channel, ChannelData, ChannelGroup, ChannelOptions, ChannelTypes, Domain, ExpandedChannelGroup, ExpandedDomain, Member, Role, UserPermissions } from '@/lib/types';
import { swrErrorWrapper } from '@/lib/utility/error-handler';

import { useDbQuery } from './use-db-query';
import { SwrWrapper } from './use-swr-wrapper';
import { useSession } from './use-session';


////////////////////////////////////////////////////////////
function mutators(mutate: KeyedMutator<ExpandedDomain>, session?: SessionState) {
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
				if (!domain) return;

				// Create channel
				const channel: Omit<Channel, 'id'> = {
					domain: domain.id,
					name,
					type,
					data,
					time_created: new Date().toISOString(),
				};

				// Create channel
				const { id, data: newData } = await addChannel(channel, group_id, options, session);

				// Merge data
				let merged: any = { ...data, ...newData };
				if (Object.keys(merged).length === 0)
					merged = undefined;

				// Update channels
				const channels = {
					...domain.channels,
					[id]: { ...channel, id, data: merged },
				};

				// Update groups
				const groups = domain.groups.slice();
				const idx = groups.findIndex(x => x.id === group_id);
				groups[idx] = { ...groups[idx], channels: [...groups[idx].channels, id] };

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
				const results = await query<Channel[]>(
					sql.update<Channel>(channel_id, {
						set: { name },
						return: ['name'],
					}),
					{ session }
				);
				assert(results && results.length > 0);

				// Replace channel with new object
				const channels = {
					...domain.channels,
					[channel_id]: { ...domain.channels[channel_id], name: results[0].name },
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
				// Get channel type
				const channel = domain.channels[channel_id];
				if (!channel) return domain;

				// Delete channel
				await removeChannel(channel_id, channel.type, session);

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
					const ops: string[] = [];

					// Id of the channel before dst index
					const before = to.index === 0 ? null : dstChannels[to.index - 1];
					// The id of the channel being moved
					const target_id = channel_id.split(':')[1];

					if (same) {
						ops.push(sql.update<ChannelGroup>(to.group_id, {
							set: {
								channels: sql.fn<ChannelGroup>('move_channel_dst_same', function() {
									const targetRecord = `channels:${target_id}`;
	
									const from = this.channels.findIndex(x => x.toString() === targetRecord);
									const to = before ? this.channels.findIndex(x => x.toString() === before) + 1 : 0;
	
									this.channels.splice(from, 1);
									this.channels.splice(to, 0, new_Record('channels', target_id));
	
									return this.channels;
								}, { before, target_id }),
							},
						}));
					}

					else {
						// Modify src group
						ops.push(sql.update<ChannelGroup>(from.group_id, {
							set: {
								channels: sql.fn<ChannelGroup>('move_channel_src_diff', function() {
									const from = this.channels.findIndex(x => x.toString() === target_id);
									this.channels.splice(from, 1);
	
									return this.channels;
								}, { target_id: `channels:${target_id}` }),
							},
						}));

						// Modify dst group
						ops.push(sql.update<ChannelGroup>(to.group_id, {
							set: {
								channels: sql.fn<ChannelGroup>('move_channel_dst_diff', function() {
									const to = before ? this.channels.findIndex(x => x.toString() === before) + 1 : 0;
									this.channels.splice(to, 0, new_Record('channels', target_id));
	
									return this.channels;
								}, { before, target_id }),
							},
						}));

						// Switch inherited channel group if needed
						ops.push(sql.update<Channel>(channel_id, {
							set: {
								inherit: sql.$(sql.wrap(sql.if({
									cond: '$before = NONE || $before = NULL',
									body: 'NONE',
								}, {
									body: to.group_id,
								}))),
							}
						}));
					}

					// Perform transaction
					const results = await query(sql.transaction(ops), { session });
					assert(results);

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
				// List of operations
				const ops = [
					sql.let('$group', sql.create<ChannelGroup>('channel_groups', {
						domain: domain.id,
						name,
						channels: [],
					})),
					sql.update<Domain>(domain.id, {
						set: { groups: ['+=', sql.$('$group.id')] },
						return: 'NONE',
					}),
					sql.return('$group'),
				];

				// Add entry list
				if (allow_everyone) {
					ops.splice(2, 0, sql.create<AclEntry>('acl', {
						domain: domain.id,
						resource: sql.$('$group.id'),
						role: domain._default_role,
						permissions: [
							'can_view',
							'can_send_messages',
							'can_send_attachments',
							'can_broadcast_audio',
							'can_broadcast_video',
						],
					}));
				}

				// Create group
				const results = await query<ChannelGroup>(sql.transaction(ops), { session });
				assert(results);

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
				// Perform query
				const results = await query<ChannelGroup[]>(
					sql.update<ChannelGroup>(group_id, { set: { name } }),
					{ session }
				);
				assert(results);

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
				// Find group
				const idx = domain.groups.findIndex(x => x.id === group_id);
				if (idx < 0) return domain;
				const group = domain.groups[idx];

				// List of db ops
				const ops = [
					sql.delete(group_id),
					sql.update<Domain>(domain.id, { set: { groups: ['-=', group_id] } }),
				];
				
				// Delete every channel
				const channels = { ...domain.channels };
				for (const channel_id of group.channels) {
					const channel = domain.channels[channel_id];
					if (!channel) continue;

					ops.push(...(await removeChannel(channel_id, channel.type)) as string[]);

					// Remove from list
					delete channels[channel_id];
				}

				// Delete
				await query(sql.transaction(ops), { session });

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

				// Set list
				await query(
					sql.update<Domain>(domain.id, {
						set: {
							groups: sql.fn<Domain>('move_group', function() {
								const targetRecord = `channel_groups:${group_id}`;

								const from = this.groups.findIndex(x => x.toString() === targetRecord);
								const to = before ? this.groups.findIndex(x => x.toString() === before) + 1 : 0;

								this.groups.splice(from, 1);
								this.groups.splice(to, 0, new_Record('channel_groups', group_id));

								return this.groups;
							}, { before, group_id }),
						},
					}),
					{ session }
				);

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
		 * Perform a batch of role operations
		 * 
		 * @param options Role update options
		 * @param options.added A list of roles to be added
		 * @param options.changed A map of role ids to new roles to be merged into existing ones
		 * @param options.deleted A list of role ids to be deleted
		 * @returns The new domain object
		 */
		updateRoles: (options: { added?: Partial<Role>[]; changed?: Record<string, Partial<Role>>; deleted?: string[] }) => mutate(
			swrErrorWrapper(async (domain: ExpandedDomain) => {
				// Operations
				const operations: string[] = [];

				// Add
				if (options.added) {
					// Create operations
					for (const role of options.added) {
						operations.push(sql.create<Role>('roles', {
							...role,
							domain: domain.id,
						}));
					}
				}

				// Change
				if (options.changed) {
					// Update operations
					for (const [id, role] of Object.entries(options.changed))
						operations.push(sql.update<Role>(id, { content: role }));
				}

				// Delete
				if (options.deleted?.length)
					operations.push(sql.delete(options.deleted));

				// Refetch all roles
				operations.push(sql.select<Role>('*', {
					from: 'roles',
					where: sql.match({ domain: domain.id }),
				}));

				// Execute as transaction
				const results = await query<Role[]>(sql.transaction(operations), { session });
				assert(results);

				return {
					...domain,
					roles: results,
				};
			}, { message: 'An error occurred while updating roles' }),
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

	return useDbQuery<ExpandedDomain, DomainMutators>(domain_id, {
		builder: (key) => {
			assert(domain_id);

			return sql.multi([
				sql.let('$member', sql.wrap(
					sql.select<Member>(['roles', 'is_admin', 'is_owner'], {
						from: `${domain_id}<-member_of`,
						where: sql.match({ in: session.profile_id }),
					}),
					{ append: '[0]' }
				)),
				sql.select<AclEntry>('*', {
					from: 'acl',
					where: sql.match<AclEntry>({
						domain: domain_id,
						role: ['IN', sql.$('$member.roles')]
					}),
				}),
				sql.select<Channel>('*', {
					from: 'channels',
					where: sql.match({ domain: domain_id }),
				}),
				sql.select<Domain>([
					'*',
					sql.wrap(sql.select<Role>('*', {
						from: 'roles',
						where: sql.match({ domain: domain_id }),
					}), { alias: 'roles' }),
				], { from: domain_id, fetch: ['groups'] }),
				sql.return('$member'),
			]);
		},
		complete: true,
		then: (results: [unknown, AclEntry[], Channel[], ExpandedDomain[], Member]) => {
			assert(results);

			const [_, entries, channels, domains, member] = results;

			// Member info
			const info: UserPermissions = {
				roles: member.roles || [],
				is_admin: member.is_admin || false,
				is_owner: member.is_owner || false,
				permissions: {},
			};

			// Add entries to map
			for (const entry of entries) {
				if (!info.permissions[entry.resource])
					info.permissions[entry.resource] = new Set<AllPermissions>(entry.permissions);
				else {
					const set = info.permissions[entry.resource];
					for (const perm of entry.permissions)
						set.add(perm);
				}
			}

			// Map channel id to channel object
			const channelMap: Record<string, Channel> = {};
			for (const channel of channels) {
				if (channel)
					channelMap[channel.id] = channel;
			}

			return results?.length ? {
				...domains[0],
				channels: channelMap,
				groups: domains[0].groups.filter(x => x).map(group => ({
					...group,
					channels: group.channels.filter(id => channelMap[id]),
				})),
				_permissions: info,
			} : null;
		},
		mutators,
	});
}


/** Check if user has a certain permission */
export function hasPermission(domain: DomainWrapper, resource: string, permission: AllPermissions) {
	let resource_id = resource.startsWith('channels') ? (domain.channels[resource].inherit || resource) : (cache.get(resource)?.data?.inherit || resource);
	return domain._permissions.is_admin || domain._permissions.permissions[resource_id]?.has(permission);
}