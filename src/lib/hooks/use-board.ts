import { KeyedMutator } from 'swr';
import assert from 'assert';

import { SessionState } from '@/lib/contexts';
import { query, sql } from '@/lib/db';
import { Board, TaskTag } from '@/lib/types'; 
import { useDbQuery } from '@/lib/hooks/use-db-query';

import { swrErrorWrapper } from '@/lib/utility/error-handler';
import { SwrWrapper } from '@/lib/utility/swr-wrapper';


////////////////////////////////////////////////////////////
function mutators(mutate: KeyedMutator<Board>, session?: SessionState) {
	assert(session);

	return {
		/**
		 * Add new tags to a board
		 * 
		 * @param tags A list of new tags to add without the id
		 * @returns The new board object
		 */
		addTags: (tags: Partial<TaskTag>[]) => mutate(
			swrErrorWrapper(async (board: Board) => {
				if (!board) return;

				// Determine which tags are new and which have an id they need to update
				const withIds: Partial<TaskTag>[] = [];
				const newTags: Omit<TaskTag, 'id'>[] = [];
				for (const tag of tags) {
					if (tag.id)
						withIds.push(tag);
					else
						newTags.push(tag as Omit<TaskTag, 'id'>);
				}

				// Add tags
				const results = await query<Board[]>(
					sql.update<Board>(board.id, {}, {
						set: {
							// Function that updates existing tags and adds new ones
							tags: sql.fn<Board>(function() {
								for (const tag of withIds) {
									const idx = this.tags.findIndex(x => x.id === tag.id);
									this.tags[idx] = { ...this.tags[idx], ...tag };
								}

								return this.tags.concat(newTags.map((x, i) => ({ ...x, id: this._tag_counter + i + 1 })));
							}, { withIds, newTags }),

							_tag_counter: ['+=', newTags.length],
						},
						return: ['tags', '_tag_counter'],
					}),
					{ session }
				);
				assert(results && results[0]);

				return {
					...board,
					_tag_counter: results[0]._tag_counter,
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