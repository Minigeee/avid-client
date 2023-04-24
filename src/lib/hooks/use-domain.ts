
import { KeyedMutator } from 'swr';
import assert from 'assert';

import config from '@/config';
import { SessionContextState } from '@/lib/contexts';
import { query, sql } from '@/lib/db';
import { Channel, ChannelData, ChannelOptions, ChannelTypes, Domain, ExpandedDomain } from '@/lib/types';
import { swrErrorWrapper } from '@/lib/utility/error-handler';
import { SwrWrapper } from '@/lib/utility/swr-wrapper';

import { useDbQuery } from './use-db-query';


////////////////////////////////////////////////////////////
function mutators(mutate: KeyedMutator<ExpandedDomain>, session?: SessionContextState) {
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
				const results = await query<Channel[]>(
					sql.create<Channel>('channels', {
						domain: domain.id,
						name,
						type,
						data,
					}, ['id']),
					{ session }
				);
				assert(results && results.length > 0);

				const id: string = results[0].id;

				// Update channels
				const channels = [
					...domain.channels,
					{
						_id: id,
						type,
						name,
						data,
					}
				];

				return {
					...domain,
					channels,
				};
			}, { message: 'An error occurred while creating channel' }),
			{ revalidate: false }
		),

		/**
		 * Remove a channel from the domain object
		 * 
		 * @param channel_id The id of the channel to remove
		 * @returns The new domain object
		 */
		removeChannel: (channel_id: string) => mutate(
			swrErrorWrapper(async (domain: ExpandedDomain) => {
				if (!domain) return;

				// Delete channel
				await query(sql.delete(channel_id));

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
	};
}


/** Mutators that will be attached to the domain swr wrapper */
export type DomainMutators = ReturnType<typeof mutators>;
/** Swr data wrapper for a domain object */
export type DomainWrapper<Loaded extends boolean = true> = SwrWrapper<ExpandedDomain, DomainMutators, false, Loaded>;


/**
 * A swr hook that performs an api query to retrieve a domain.
 * 
 * @param domain_id The id of the domain to retrieve
 * @returns A swr wrapper object containing the requested domain
 */
export function useDomain(domain_id: string) {
	return useDbQuery<ExpandedDomain, DomainMutators>(domain_id, (key) => {
		return sql.select<Domain>([
			'*',
			sql.wrap(sql.select<Channel>(
				['id', 'name', 'type', 'data'],
				{ from: 'channels', where: sql.match({ domain: domain_id }) }
			), { alias: 'channels' })
		], { from: domain_id });
	}, {
		then: (results) => results?.length ? results[0] : null,
		mutators,
	});
}