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
		addTags: (tags: Omit<TaskTag, 'id'>[]) => mutate(
			swrErrorWrapper(async (board: Board) => {
				if (!board) return;

				// Add tags
				const results = await query<Board[]>(
					sql.update<Board>(board.id, {}, {
						set: {
							tags: ['+=', tags.map((x, i) => ({ id: sql.$(`_tag_counter+${i + 1}`), ...x }))],
							_tag_counter: ['+=', tags.length],
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
export function useBoard(board_id: string) {
	return useDbQuery(board_id, (key) => {
		return sql.select<Board[]>('*', { from: board_id });
	}, {
		then: (results) => results?.length ? results[0] : null,
		mutators,
	});
}