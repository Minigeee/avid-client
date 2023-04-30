import useSWR, { KeyedMutator } from 'swr';
import assert from 'assert';

import { SessionState } from '@/lib/contexts';
import { getMembers, query, sql } from '@/lib/db';
import { Board, ExpandedTask, Member, Task } from '@/lib/types';
import { useSession } from '@/lib/hooks';

import { swrErrorWrapper } from '@/lib/utility/error-handler';
import { SwrWrapper, wrapSwrData } from '@/lib/utility/swr-wrapper';


////////////////////////////////////////////////////////////
function fetcher(session: SessionState) {
	return async (key: string) => {
		// Get board id
		const board_id = key.split('.')[0];

		// Get (all) tasks
		const results = await query<[Task[], Board[]]>(sql.multi([
			sql.select<Task>([
				'id',
				'sid',
				'summary',
				'status',
				'assignee',
				'priority',
				'cycle',
				'due_date',
				'tags',
				'dependencies',
				'subtasks',
				'time_created',
			], {
				from: 'boards',
				where: sql.match({ board: board_id }),
			}),
			sql.select<Board>(['domain'], { from: board_id }),
		]), { session });
		assert(results);

		const tasks = results[0];
		const { domain } = results[1][0];

		// Get map of assignees
		const assignees: Record<string, Member | null> = {};
		for (const task of tasks) {
			if (task.assignee)
				assignees[task.assignee] = null;
		}

		// Get members
		const members = await getMembers(domain, Object.keys(assignees), session);
		for (const member of members)
			assignees[member.id] = member;

		// Attach senders and pings to message
		const expanded: ExpandedTask[] = tasks.map(task => ({
			...task,
			assignee: task.assignee ? assignees[task.assignee] || undefined : undefined,
		}));

		return expanded;
	};
}


////////////////////////////////////////////////////////////
function mutators(board_id: string) {
	return (mutate: KeyedMutator<ExpandedTask[]>, session?: SessionState) => {
		assert(session);

		return {
			/**
			 * Add a new task to the board
			 * 
			 * @param task The new task to add with all fields except `summary` being optional
			 * @returns The new board object
			 */
			addTask: (task: Partial<ExpandedTask> & { summary: string }) => mutate(
				swrErrorWrapper(async (tasks: ExpandedTask[]) => {
					// Creation time
					const now = new Date();

					// Create task
					const results = await query<Task[]>(sql.transaction([
						// Increment counter
						sql.update<Board>(board_id, {}, { set: { _task_counter: ['+=', 1] } }),

						// Create task
						sql.create<Task>('tasks', {
							...task,
							sid: sql.$('_task_counter'),
							board: board_id,
							status: task.status || 'To Do',
							assignee: task.assignee?.id || undefined,
							time_created: now,
						}),
					]), { session });
					assert(results && results.length);

					return [
						...tasks, {
							...results[0],
							assignee: task.assignee,
						},
					];
				}, { message: 'An error occurred while creating task' }),
				{ revalidate: false }
			),

			/**
			 * Update a task object within the board
			 * 
			 * @param task_id The string id of the task to update
			 * @param task A task object with updated properties
			 * @param domain_id The domain the task is being added to retrieve assignee data
			 * @returns A board object with the updated task
			 */
			updateTask: (task_id: string, task: Partial<ExpandedTask>) => mutate(
				swrErrorWrapper(async (tasks: ExpandedTask[]) => {
					if (task.id !== undefined) delete task.id;
					if (task.sid !== undefined) delete task.sid;
					if (task.board !== undefined) delete task.board;

					// Update task
					const results = await query<Task[]>(
						sql.update<Task>(task_id, {
							...task,
							assignee: task.assignee === null ? null : task.assignee?.id,
						}),
						{ session }
					);
					assert(results && results.length > 0);

					// Create new updated task list
					const copy = tasks.slice();
					const index = copy.findIndex(x => x.id === task_id);
					copy[index] = {
						...results[0],
						assignee: task.assignee,
					};

					return copy;
				}, { message: 'An error occurred while modifying task' }),
				{ revalidate: false }
			),

			/**
			 * Remove a task from the board object
			 * 
			 * @param task_id The string id of the task to remove
			 * @returns The new board object
			 */
			removeTask: (task_id: string) => mutate(
				swrErrorWrapper(async (tasks: ExpandedTask[]) => {
					// Send delete task
					await query(sql.delete(task_id));

					return tasks.filter(x => x.id !== task_id);
				}, { message: 'An error occurred while deleting task' }),
				{
					revalidate: false,
					rollbackOnError: true,
					optimisticData: (tasks) => {
						return tasks?.filter(x => x.id !== task_id) || [];
					}
				}
			),
		};
	}
}


/** Mutators that will be attached to the board swr wrapper */
export type TasksMutators = ReturnType<ReturnType<typeof mutators>>;
/** Swr data wrapper for a domain object */
export type TasksWrapper<Loaded extends boolean = true> = SwrWrapper<ExpandedTask[], TasksMutators, true, Loaded>;

/**
 * A swr hook that performs an db query to retrieve tasks from a project board.
 * 
 * @param board_id The id of the board to retrieve tasks from
 * @returns A swr object containing the requested tasks
 */
export function useTasks(board_id: string) {
	const session = useSession();
	const swr = useSWR<ExpandedTask[] | null>(
		board_id && session.token ? `${board_id}.tasks` : null,
		fetcher(session)
	);

	return wrapSwrData<ExpandedTask[], TasksMutators, true>(swr, mutators(board_id), true, session);
}
