
import assert from 'assert';

import config from '@/config';
import { SessionState } from '@/lib/contexts';
import { query, sql } from '@/lib/db';
import {
	AclEntry,
	AllChannelPermissions,
	Board,
	Channel,
	ChannelData,
	ChannelGroup,
	ChannelOptions,
	ChannelTypes,
	Domain
} from '@/lib/types';


/** Common channel create lines */
function commonCreateOps(channel: Partial<Channel>, group_id: string, data: Record<keyof ChannelData<any>, any> | undefined) {
	return [
		sql.let('$channel', sql.create<Channel>('channels', {
			...channel,
			inherit: group_id,
			data: { ...channel.data, ...data },
		}, ['id', 'data'])),
	];
}


/** Default function for creating channel */
function addDefaultChannel(channel: Partial<Channel>, group_id: string, session: SessionState) {
	assert(channel.domain);

	return query<Channel[]>(sql.transaction([
		...commonCreateOps(channel, group_id, undefined),
		sql.select('*', { from: '$channel' }),
	]), { session });
}

/** Create board channel */
function addBoardChannel(channel: Partial<Channel>, group_id: string, options: ChannelOptions<'board'>, session: SessionState) {
	assert(channel.domain);

	return query<Channel[]>(sql.transaction([
		sql.let('$board', sql.create<Board>('boards', {
			domain: channel.domain,
			inherit: group_id,
			prefix: options.prefix,
			statuses: config.app.board.default_statuses,
			tags: [],
			collections: [config.app.board.default_backlog],
			time_created: channel.time_created,

			_task_counter: 0,
			_id_counter: 1,
		}, ['id'])),

		...commonCreateOps(channel, group_id, { board: sql.$('$board.id') }),

		sql.select('*', { from: '$channel' }),
	]), { session });
}


/**
 * Create a channel within the domain specified by the object. Handles
 * the creation of different channel types.
 * 
 * @param channel The channel object to add to database
 * @param group_id The id of the group to create the channel in
 * @param options The channel creation options
 * @param session The session used to access database
 * @returns The created channel object
 */
export async function addChannel<T extends ChannelTypes>(channel: Partial<Channel>, group_id: string, options: ChannelOptions<T> | undefined, session: SessionState) {
	let results: Channel[] | null = null;

	if (channel.type === 'board') {
		assert(options);
		results = await addBoardChannel(channel, group_id, options as ChannelOptions<'board'>, session);
	}
	else
		results = await addDefaultChannel(channel, group_id, session);

	assert(results && results.length > 0);

	return results[0];
}


/**
 * Remove a channel from the domain object. This function handles
 * any special operations required for each channel type.
 * 
 * @param channel_id The id of the channel to remove
 * @param type The channel type, required to determine the correct delete actions
 * @param session The session used to access database (if this is not provided, then the query won't be performed, and rather the list of ops will be returned instead)
 */
export async function removeChannel(channel_id: string, type: ChannelTypes, session?: SessionState) {
	let transaction: string[] = [sql.let('$channel', sql.delete(channel_id, { return: 'BEFORE' }))];

	// Board
	if (type === 'board') {
		transaction.push(
			sql.delete('$channel.data.board'),
		);
	}

	if (session)
		await query(sql.transaction(transaction), { session });
	else
		return transaction;
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