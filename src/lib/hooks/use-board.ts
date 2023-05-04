import { KeyedMutator } from 'swr';
import assert from 'assert';

import { SessionState } from '@/lib/contexts';
import { query, sql } from '@/lib/db';
import { Board, Label, NoId, TaskCollection, WithId } from '@/lib/types'; 
import { useDbQuery } from '@/lib/hooks/use-db-query';

import { swrErrorWrapper } from '@/lib/utility/error-handler';
import { SwrWrapper } from '@/lib/utility/swr-wrapper';

import sanitizeHtml from 'sanitize-html';


////////////////////////////////////////////////////////////
function _sanitize(board: Board) {
	for (const c of board.collections)
		_sanitizeCollection(c);

	return board;
}

////////////////////////////////////////////////////////////
function _sanitizeCollection(collection: Partial<TaskCollection>): Partial<TaskCollection> {
	if (collection.description)
		collection.description = sanitizeHtml(collection.description);

	collection.start_date = '5/4/2023';
	collection.end_date = '5/10/2023';
	return collection;
}


////////////////////////////////////////////////////////////
function mutators(mutate: KeyedMutator<Board>, session?: SessionState) {
	assert(session);

	return {
		/**
		 * Add new task collection.
		 * 
		 * @param collection The collection that should be added omitting the `id`
		 * @returns The new board object
		 */
		addCollection: (collection: NoId<TaskCollection>) => mutate(
			swrErrorWrapper(async (board: Board) => {
				// Add group, iterate id counter
				const results = await query<Board[]>(
					sql.update<Board>(board.id, {}, {
						set: {
							collections: ['+=', { id: sql.$('_id_counter'), ..._sanitizeCollection(collection) }],
							_id_counter: ['+=', 1],
						},
						return: ['collections', '_id_counter'],
					}),
					{ session }
				);
				assert(results && results.length);

				return {
					...board,
					_id_counter: results[0]._id_counter,
					collections: results[0].collections.map(_sanitizeCollection),
				};
			}),
			{ revalidate: false }
		),

		/**
		 * Add new tags, or modify existing tags. A list of tags should be
		 * provided in `options.add` for every new tag to be added, and a list of
		 * tag updates should be provided in `options.update` for every
		 * tag to be updated.
		 * 
		 * @param options.add A list of new tags to add
		 * @param options.update A list of tags to modify
		 * @returns The new board object
		 */
		addTags: (options: { add?: Label[], update?: WithId<Partial<Label>>[] }) => mutate(
			swrErrorWrapper(async (board: Board) => {
				const add = options.add || [];
				const update = options.update || [];

				// Add tags
				const results = await query<Board[]>(
					sql.update<Board>(board.id, {}, {
						set: {
							// Function that updates existing tags and adds new ones
							tags: sql.fn<Board>(function() {
								// Merge updates
								for (const tag of update) {
									const idx = this.tags.findIndex(x => x.id === tag.id);
									if (idx >= 0)
										this.tags[idx] = { ...this.tags[idx], ...tag };
								}

								// Add new tags
								return this.tags.concat(add.map((x, i) => ({ ...x, id: (this._id_counter + i).toString() })));
							}, { add, update }),

							_id_counter: ['+=', add.length],
						},
						return: ['tags', '_id_counter'],
					}),
					{ session }
				);
				assert(results && results[0]);

				return {
					...board,
					_id_counter: results[0]._id_counter,
					tags: results[0].tags,
				};
			}, { message: 'An error occurred while creating tags' }),
			{ revalidate: false }
		),
	};
}


/** Mutators that will be attached to the board swr wrapper */
export type BoardMutators = ReturnType<typeof mutators>;
/** Swr data wrapper for a domain object */
export type BoardWrapper<Loaded extends boolean = true> = SwrWrapper<Board, BoardMutators, false, Loaded>;

/**
 * A swr hook that performs an db query to retrieve a project board.
 * This does not retrieve the tasks that belong to the project.
 * Use `useTasks()` instead.
 * 
 * @param board_id The id of the board to retrieve
 * @returns A swr object containing the requested profile
 */
export function useBoard(board_id?: string) {
	assert(!board_id || board_id.startsWith('boards:'));

	return useDbQuery(board_id, (key) => {
		return sql.select<Board[]>('*', { from: board_id || '' });
	}, {
		then: (results) => results?.length ? _sanitize(results[0]) : null,
		mutators,
	});
}