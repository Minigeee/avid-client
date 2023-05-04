
import assert from 'assert';

import config from '@/config';
import { SessionState } from '@/lib/contexts';
import { query, sql } from '@/lib/db';
import { Board, Channel, ChannelOptions, ChannelTypes } from '@/lib/types';


/** Default function for creating channel */
function addDefaultChannel(channel: Partial<Channel>, session: SessionState) {
	return query<Channel[]>(
		sql.create<Channel>('channels', channel, ['id', 'data']),
		{ session }
	);
}

/** Create board channel */
function addBoardChannel(channel: Partial<Channel>, options: ChannelOptions<'board'>, session: SessionState) {
	return query<Channel[]>(sql.transaction([
		sql.let('$board', sql.create<Board>('boards', {
			domain: channel.domain,
			prefix: options.prefix,
			statuses: config.app.board.default_statuses,
			tags: [],
			collections: [config.app.board.default_backlog],

			_task_counter: 0,
			_id_counter: 0,
		}, ['id'])),
		sql.create<Channel>('channels', {
			...channel,
			data: { ...channel.data, board: sql.$('$board.id') },
		}, ['id', 'data']),
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
 * @param session The session used to access database
 * @returns The new domain object
 */
export async function removeChannel(channel_id: string, session: SessionState) {
	// Delete channel, while taking any extra actions necessary
	await query(sql.transaction([
		sql.let('$channel', sql.delete(channel_id, { return: 'BEFORE' })),
		sql.delete(sql.if({
			cond: '$channel.type = "board"',
			body: '$channel.data.board',
		})),
	]), { session });
}