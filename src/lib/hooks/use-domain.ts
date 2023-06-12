
import { KeyedMutator } from 'swr';
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
function mutators(mutate: KeyedMutator<ExpandedDomain>, session?: SessionState) {
	assert(session);

	return {
		

		/**
		 * Add a new channel to the domain
		 * 
		 * @param name The name of the channel
		 * @param type The channel type
		 * @param data Any extra data required to create the specified channel type
		 * @returns The new domain object
		 */
		addChannel: <T extends ChannelTypes>(name: string, type: T, data?: ChannelData<T>, options?: ChannelOptions<T>) => mutate(
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
				const { id, data: newData } = await addChannel(channel, options, session);

				// Merge data
				let merged: any = { ...data, ...newData };
				if (Object.keys(merged).length === 0)
					merged = undefined;

				// Update channels
				const channels: Channel[] = [
					...domain.channels,
					{ ...channel, id, data: merged },
				];

				return {
					...domain,
					channels,
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
				const channels = domain.channels.slice();
				const idx = channels.findIndex(x => x.id === channel_id);
				channels[idx] = { ...channels[idx], name: results[0].name };

				return { ...domain, channels };
			}, { message: 'An error occurred while renaming channel' }),
			{
				revalidate: false,
				optimisticData: (domain) => {
					if (!domain) throw new Error('trying to rename channel from domain that is undefined');

					// Replace channel with new object
					const channels = domain.channels.slice();
					const idx = channels.findIndex(x => x.id === channel_id);
					channels[idx] = { ...channels[idx], name };
	
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
				const channel = domain.channels.find(x => x.id === channel_id);
				if (!channel) return domain;

				// Delete channel
				await removeChannel(channel_id, channel.type, session);

				// Filter out channels that aren't removed
				const channels = domain.channels.filter(x => x.id !== channel_id);
				return { ...domain, channels };
			}, { message: 'An error occurred while deleting channel' }),
			{
				revalidate: false,
				optimisticData: (domain) => {
					if (!domain) throw new Error('trying to remove channel from domain that is undefined');
					const channels = domain.channels.filter(x => x.id !== channel_id);
					return { ...domain, channels };
				}
			}
		),

		/**
		 * Set the order channels appear in this domain
		 * TEMP : After adding channel groups, this will have to be changed.
		 * 
		 * @param channels The channel objects in the order they should appear
		 * @returns The new domain object
		 */
		setChannelOrder: (channels: Channel[]) => mutate(
			swrErrorWrapper(async (domain: ExpandedDomain) => {
				if (!domain) return;

				// Set channel ids
				const ids = channels.map(x => x.id);
				await query<Domain>(
					sql.update<Domain>(domain.id, { set: { channels: ids } }),
					{ session }
				);

				return { ...domain, channels };
			}, { message: 'An error occurred while changing channel order' }),
			{
				revalidate: false,
				optimisticData: (domain) => {
					assert(domain);
					return { ...domain, channels };
				}
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
				sql.select<Domain>([
					'*',
					sql.wrap(sql.select<Role>(['id', 'label', 'description', 'color'], {
						from: 'roles',
						where: sql.match({ id: domain_id }),
					}), { alias: 'roles' }),
				], { from: domain_id, fetch: ['channels'] }),
				sql.return('$member'),
			]);
		},
		complete: true,
		then: (results: [unknown, AclEntry[], ExpandedDomain[], Member]) => {
			assert(results);

			const [_, entries, domains, member] = results;

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

			return results?.length ? {
				...domains[0],
				channels: domains[0].channels.filter(x => x),
				_permissions: info,
			} : null;
		},
		mutators,
	});
}


/** Check if user has a certain permission */
export function hasPermission(domain: DomainWrapper, resource_id: string, permission: AllPermissions) {
	return domain._permissions.is_admin || domain._permissions.permissions[resource_id]?.has(permission);
}