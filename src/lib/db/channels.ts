
import assert from 'assert';

import config from '@/config';
import { SessionState } from '@/lib/contexts';
import { query, sql } from '@/lib/db';
import {
	AclEntry,
	AllChannelPermissions,
	Board,
	Channel,
	ChannelOptions,
	ChannelTypes,
	Domain
} from '@/lib/types';


/** Default function for creating channel */
function addDefaultChannel(channel: Partial<Channel>, session: SessionState) {
	assert(channel.domain);

	// Default permissions per channel type
	const permissions: AllChannelPermissions[] = ['can_view'];
	if (channel.type === 'text' || channel.type === 'board') {
		permissions.push('can_send_messages');
		permissions.push('can_send_attachments');
	}

	return query<Channel[]>(sql.transaction([
		sql.let('$channel', sql.create<Channel>('channels', channel, ['id', 'data'])),
		sql.update<Domain>(channel.domain, {
			set: { channels: ['+=', sql.$('$channel.id')] },
			return: 'NONE',
		}),

		sql.create<AclEntry>('acl', {
			domain: channel.domain,
			resource: sql.$('$channel.id'),
			role: sql.$(`${channel.domain}._default_role`),
			permissions,
		}),
		
		sql.select('*', { from: '$channel' }),
	]), { session });
}

/** Create board channel */
function addBoardChannel(channel: Partial<Channel>, options: ChannelOptions<'board'>, session: SessionState) {
	assert(channel.domain);

	return query<Channel[]>(sql.transaction([
		sql.let('$board', sql.create<Board>('boards', {
			domain: channel.domain,
			prefix: options.prefix,
			statuses: config.app.board.default_statuses,
			tags: [],
			collections: [config.app.board.default_backlog],
			time_created: channel.time_created,

			_task_counter: 0,
			_id_counter: 1,
		}, ['id'])),
		sql.let('$channel', sql.create<Channel>('channels', {
			...channel,
			data: { ...channel.data, board: sql.$('$board.id') },
		}, ['id', 'data'])),
		sql.update<Domain>(channel.domain, {
			set: { channels: ['+=', sql.$('$channel.id')] },
			return: 'NONE',
		}),

		sql.create<AclEntry>('acl', {
			domain: channel.domain,
			resource: sql.$('$channel.id'),
			role: sql.$(`${channel.domain}._default_role`),
			permissions: ['can_view'],
		}),
		sql.create<AclEntry>('acl', {
			domain: channel.domain,
			resource: sql.$('$board.id'),
			role: sql.$(`${channel.domain}._default_role`),
			permissions: ['can_view'],
		}),

		sql.select('*', { from: '$channel' }),
	]), { session });
}


/**
 * Create a channel within the domain specified by the object. Handles
 * the creation of different channel types.
 * 
 * @param channel The channel object to add to database
 * @param options The channel creation options
 * @param session The session used to access database
 * @returns The created channel object
 */
export async function addChannel<T extends ChannelTypes>(channel: Partial<Channel>, options: ChannelOptions<T> | undefined, session: SessionState) {
	let results: Channel[] | null = null;

	if (channel.type === 'board') {
		assert(options);
		results = await addBoardChannel(channel, options as ChannelOptions<'board'>, session);
	}
	else
		results = await addDefaultChannel(channel, session);

	assert(results && results.length > 0);

	return results[0];
}


/**
 * Remove a channel from the domain object. This function handles
 * any special operations required for each channel type.
 * 
 * @param channel_id The id of the channel to remove
 * @param type The channel type, required to determine the correct delete actions
 * @param session The session used to access database
 */
export async function removeChannel(channel_id: string, type: ChannelTypes, session: SessionState) {
	let transaction: string[] = [sql.let('$channel', sql.delete(channel_id, { return: 'BEFORE' }))];

	// Board
	if (type === 'board') {
		transaction = transaction.concat([
			sql.delete('$channel.data.board'),
		]);
	}

	// Execute query
	transaction.push(sql.update<Domain>('($channel.domain)', { set: { channels: ['-=', channel_id] } }));
	await query(sql.transaction(transaction), { session });
}


/**
 * Retrieve a channel from the database
 * 
 * @param channel_id The channel to retrieve
 * @param session The session used to access database
 * @returns The channel object
 */
export async function getChannel<T extends ChannelTypes = ChannelTypes>(channel_id: string, session?: SessionState) {
	const results = await query<Channel<T>[]>(sql.select('*', { from: channel_id }), { session });
	assert(results && results.length);
	return results[0];
}