
import assert from 'assert';

import config from '@/config';
import { SessionState } from '@/lib/contexts';
import { query, sql } from '@/lib/db';
import { Board, Channel, ChannelData, ChannelOptions, ChannelTypes, Domain, ExpandedDomain } from '@/lib/types';
import { swrErrorWrapper } from '@/lib/utility/error-handler';
import { SwrWrapper } from '@/lib/utility/swr-wrapper';


/** Default function for creating channel */
function addDefaultChannel(channel: Partial<Channel>, session: SessionState) {
	return query<Channel[]>(
		sql.create<Channel>('channels', channel, ['id']),
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

			_task_counter: 0,
			_tag_counter: 0,
		}, ['id'])),
		sql.create<Channel>('channels', {
			...channel,
			data: { ...channel.data, board: sql.$('$board.id') },
		}, ['id']),
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