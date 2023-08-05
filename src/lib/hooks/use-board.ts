import { KeyedMutator, mutate as _mutate } from 'swr';
import assert from 'assert';

import config from '@/config';
import { api } from '@/lib/api';
import { SessionState } from '@/lib/contexts';
import { Board, ExpandedTask, Label, NoId, Task, TaskCollection, WithId } from '@/lib/types'; 

import { useApiQuery } from './use-api-query';
import { SwrWrapper } from '@/lib/hooks/use-swr-wrapper';
import { swrErrorWrapper } from '@/lib/utility/error-handler';

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
				// Post new collection
				const results = await api('POST /boards/:board_id/collections', {
					params: { board_id: board.id },
					body: collection
				}, { session });

				return {
					...board,
					_id_counter: results._id_counter,
					collections: results.collections.map(_sanitizeCollection),
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
				// Update collection
				const results = await api('PATCH /boards/:board_id/collections/:collection_id', {
					params: { board_id: board.id, collection_id },
					body: collection,
				}, { session });

				return {
					...board,
					collections: results.collections.map(_sanitizeCollection),
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
				const results = await api('DELETE /boards/:board_id/collections/:collection_id', {
					params: { board_id: board.id, collection_id },
				}, { session });

				// Id set
				const idSet = new Set<string>(results.tasks_changed);

				// Update tasks that got changed
				if (idSet.size > 0) {
					_mutate(`${board.id}.tasks`, (tasks: ExpandedTask[] | undefined) => {
						if (!tasks) return;
	
						const copy = tasks.slice();
						for (let i = 0; i < copy.length; ++i) {
							if (idSet.has(copy[i].id))
								copy[i] = { ...copy[i], collection: config.app.board.default_backlog.id };
						}
						return copy;
					});

					_mutate((key) => typeof key === 'string' && idSet.has(key), (data: ExpandedTask | undefined) => {
						if (!data) return data;
						return { ...data, collection: config.app.board.default_backlog.id };
					});
				}

				return {
					...board,
					collections: results.collections.map(_sanitizeCollection),
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
		 * Add new task collection locally. This will not add collection in database.
		 * It should only be used to reflect changes from sockets.
		 * 
		 * @param collection The collection that should be added
		 * @returns The new board object
		 */
		addCollectionLocal: (collection: TaskCollection) => mutate(
			swrErrorWrapper(async (board: Board) => {
				return {
					...board,
					_id_counter: parseInt(collection.id) + 1,
					collections: [...board.collections, _sanitizeCollection(collection)],
				};
			}, { message: 'An error occurred while displaying added task collection' }),
			{ revalidate: false }
		),

		/**
		 * Delete collection locally. This will not add collection in database.
		 * It should only be used to reflect changes from sockets.
		 * 
		 * @param collection_id The id of the collection that should be removed
		 * @returns The new board object
		 */
		removeCollectionLocal: (collection_id: string) => mutate(
			swrErrorWrapper(async (board: Board) => {
				return {
					...board,
					collections: board.collections.filter(x => x.id !== collection_id),
				};
			}, { message: 'An error occurred while displaying updated task collection' }),
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
				// Update tags
				const results = await api('PATCH /boards/:board_id/tags', {
					params: { board_id: board.id },
					body: options,
				}, { session });

				return {
					...board,
					_id_counter: results._id_counter,
					tags: results.tags,
				};
			}, { message: 'An error occurred while creating tags' }),
			{ revalidate: false }
		),
	};
}


/** Mutators that will be attached to the board swr wrapper */
export type BoardMutators = ReturnType<typeof mutators>;
/** Swr data wrapper for a domain object */
export type BoardWrapper<Loaded extends boolean = true> = SwrWrapper<Board, Loaded, BoardMutators>;

/**
 * A swr hook that performs an db query to retrieve a project board.
 * This does not retrieve the tasks that belong to the project.
 * Use `useTasks()` instead.
 * 
 * @param board_id The id of the board to retrieve
 * @returns A swr object containing the requested profile
 */
export function useBoard(board_id: string | undefined) {
	return useApiQuery(board_id, 'GET /boards/:board_id', {
		params: { board_id: board_id || '' },
	}, {
		then: (results) => _sanitize(results),
		mutators,
	});
}