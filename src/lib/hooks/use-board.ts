import { KeyedMutator } from 'swr';
import assert from 'assert';

import { SessionState } from '@/lib/contexts';
import { query, sql } from '@/lib/db';
import { Board, Label, NoId, TaskGroup, WithId } from '@/lib/types'; 
import { useDbQuery } from '@/lib/hooks/use-db-query';

import { swrErrorWrapper } from '@/lib/utility/error-handler';
import { SwrWrapper } from '@/lib/utility/swr-wrapper';


////////////////////////////////////////////////////////////
function mutators(mutate: KeyedMutator<Board>, session?: SessionState) {
	assert(session);

	return {
		/**
		 * Add new task group.
		 * 
		 * @param group The group that should be added omitting the `id`
		 * @returns The new board object
		 */
		addGroup: (group: NoId<TaskGroup>) => mutate(
			swrErrorWrapper(async (board: Board) => {
				// Add group, iterate id counter
				const results = await query<Board[]>(
					sql.update<Board>(board.id, {}, {
						set: {
							groups: ['+=', { id: sql.$('_id_counter'), ...group }],
							_id_counter: ['+=', 1],
						},
						return: ['groups', '_id_counter'],
					}),
					{ session }
				);
				assert(results && results.length);

				return {
					...board,
					_id_counter: results[0]._id_counter,
					groups: results[0].groups,
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
		then: (results) => results?.length ? results[0] : null,
		mutators,
	});
}