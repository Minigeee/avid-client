import { KeyedMutator, mutate as _mutate } from 'swr';
import assert from 'assert';

import config from '@/config';
import { SessionState } from '@/lib/contexts';
import { query, sql } from '@/lib/db';
import { Board, ExpandedTask, Label, NoId, Task, TaskCollection, WithId } from '@/lib/types'; 
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
		collection.description = sanitizeHtml(collection.description, config.sanitize);

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
			}, { message: 'An error occurred while creating task collection' }),
			{ revalidate: false }
		),

		/**
		 * Update a task collection.
		 * 
		 * @param collection_id The id of the collection to modify
		 * @param collection The updated values of the collection
		 * @returns The new board object
		 */
		updateCollection: (collection_id: string, collection: Partial<NoId<TaskCollection>>) => mutate(
			swrErrorWrapper(async (board: Board) => {
				collection = _sanitizeCollection(collection);

				// Add group, iterate id counter
				const results = await query<Board[]>(
					sql.update<Board>(board.id, {}, {
						set: {
							collections: sql.fn<Board>(function() {
								// Find index
								const idx = this.collections.findIndex(x => x.id === collection_id);
								if (idx >= 0)
									this.collections[idx] = { ...this.collections[idx], ...collection };

								return this.collections;
							}, { collection_id, collection }),
						},
						return: ['collections'],
					}),
					{ session }
				);
				assert(results && results.length);

				return {
					...board,
					collections: results[0].collections.map(_sanitizeCollection),
				};
			}, { message: 'An error occurred while updating task collection' }),
			{ revalidate: false }
		),

		/**
		 * Removes a collection from the board. All tasks that were a part
		 * of the collection will be moved to the backlog collection.
		 * 
		 * @param collection_id The id of the collection to remove
		 * @returns The updated board object
		 */
		removeCollection: (collection_id: string) => mutate(
			swrErrorWrapper(async (board: Board) => {
				// Delete collection, move all tasks in collection, get a list of task ids
				const results = await query<[Board[], Task[]]>(sql.transaction([
					sql.update<Board>(board.id, {}, {
						set: {
							collections: sql.fn<Board>(function() {
								return this.collections.filter(x => x.id !== collection_id);
							}, { collection_id }),
						},
						return: ['collections'],
					}),
					sql.update<Task>('tasks', { collection: config.app.board.default_backlog.id }, {
						where: sql.match<Task>({ board: board.id, collection: collection_id }),
						return: ['id'],
					}),
				]), { session, complete: true });
				assert(results);

				const [newBoards, tasks] = results;
				assert(newBoards.length > 0);

				// Id set
				const idSet = new Set<string>(tasks.map(x => x.id));

				// Update tasks that got changed
				if (tasks.length > 0) {
					_mutate(`${board.id}.tasks`, (tasks: ExpandedTask[] | undefined) => {
						if (!tasks) return;
	
						const copy = tasks.slice();
						for (let i = 0; i < copy.length; ++i) {
							if (idSet.has(copy[i].id))
								copy[i] = { ...copy[i], collection: config.app.board.default_backlog.id };
						}
						return copy;
					});
				}

				return {
					...board,
					collections: newBoards[0].collections.map(_sanitizeCollection),
				};
			}, { message: 'An error occurred while removing task collection' }),
			{
				revalidate: false,
				optimisticData: (board) => {
					assert(board);
					return {
						...board,
						collections: board.collections.filter(x => x.id !== collection_id),
					};
				},
			}
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