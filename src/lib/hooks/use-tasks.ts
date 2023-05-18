import useSWR, { KeyedMutator, mutate as _mutate } from 'swr';
import assert from 'assert';

import config from '@/config';
import { SessionState } from '@/lib/contexts';
import { getDomainCache, getMember, getMembers, query, sql } from '@/lib/db';
import { Board, ExpandedTask, Member, Task } from '@/lib/types';
import { useSession } from '@/lib/hooks';

import { swrErrorWrapper } from '@/lib/utility/error-handler';

import { useDbQuery } from './use-db-query';
import { SwrWrapper, useSwrWrapper } from './use-swr-wrapper';

import sanitizeHtml from 'sanitize-html';


////////////////////////////////////////////////////////////
function _sanitize<T extends Partial<ExpandedTask>>(task: T) {
	if (task.description)
		task.description = sanitizeHtml(task.description, config.sanitize);

	return task;
}


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
				'collection',
				'due_date',
				'tags',
				'dependencies',
				'subtasks',
				'time_created',
			], {
				from: 'tasks',
				where: sql.match({ board: board_id }),
			}),
			sql.select<Board>(['domain'], { from: board_id }),
		]), { session, complete: true });
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

		// Attach senders and pings to message, sanitize tasks
		const expanded: ExpandedTask[] = tasks.map(task => _sanitize({
			...task,
			assignee: task.assignee ? assignees[task.assignee] || undefined : undefined,
		}));

		return expanded;
	};
}


////////////////////////////////////////////////////////////
function tasksMutators(board_id: string) {
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
					const now = new Date().toISOString();

					// Create task
					const results = await query<Task[]>(sql.transaction([
						// Increment counter
						sql.update<Board>(board_id, { set: { _task_counter: ['+=', 1] } }),

						// Create task
						sql.create<Task>('tasks', {
							..._sanitize(task),
							sid: sql.$(`${board_id}._task_counter`),
							board: board_id,
							status: task.status || config.app.board.default_status_id,
							assignee: task.assignee?.id || undefined,
							time_created: now,
						}),
					]), { session });
					assert(results && results.length);

					return [
						...tasks, _sanitize({
							...results[0],
							assignee: task.assignee,
						}),
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

					// Time the task is updated
					const now = new Date().toISOString();

					// Check if status changed
					const statusUpdated = task.status && task.status !== tasks.find(x => x.id === task_id)?.status;

					// Update task
					const results = await query<Task[]>(
						sql.update<Task>(task_id, {
							content: {
								..._sanitize(task),
								assignee: task.assignee === null ? null : task.assignee?.id,
								time_updated: now,
								time_status_updated: statusUpdated ? now : undefined,
							},
						}),
						{ session }
					);
					assert(results && results.length > 0);

					// Create new updated task list
					const copy = tasks.slice();
					const index = copy.findIndex(x => x.id === task_id);
					copy[index] = _sanitize({
						...results[0],
						assignee: task.assignee,
					});

					// Mutate task hook
					_mutate(task_id, copy[index], { revalidate: false });

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
					await query(sql.delete(task_id), { session });

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
export type TasksMutators = ReturnType<ReturnType<typeof tasksMutators>>;
/** Swr data wrapper for a domain object */
export type TasksWrapper<Loaded extends boolean = true> = SwrWrapper<ExpandedTask[], Loaded, TasksMutators>;

/**
 * A swr hook that performs a db query to retrieve tasks from a project board.
 * All fields are retrieved except `description`, `board`, `time_updated`, and `time_status_changed`.
 * 
 * @param board_id The id of the board to retrieve tasks from
 * @returns A swr object containing the requested tasks
 */
export function useTasks(board_id?: string) {
	return useDbQuery(board_id ? `${board_id}.tasks` : undefined, {
		fetcher,
		mutators: tasksMutators(board_id || ''),
	});
}



////////////////////////////////////////////////////////////
function taskMutators(mutate: KeyedMutator<ExpandedTask>, session?: SessionState) {
	return {
		/**
		 * Update the task object locally. Use `tasks.updatedTask` to update
		 * server data.
		 * 
		 * @param task Task object with updated properties
		 * @returns Updated task object
		 */
		updateLocal: (task: Partial<ExpandedTask>) => mutate(
			async (old) => {
				if (!old) return;
				return {
					...old,
					...task,
				};
			},
			{ revalidate: false }
		),
	};
}


/** Mutators that will be attached to the board swr wrapper */
export type TaskMutators = ReturnType<typeof taskMutators>;
/** Swr data wrapper for a domain object */
export type TaskWrapper<Loaded extends boolean = true> = SwrWrapper<ExpandedTask, Loaded, TaskMutators>;


/**
 * A swr hook that performs a db to retrieve a task.
 * 
 * @param task_id The id of the task to retrieve
 * @param fallback The optional fallback task data to display while task is loading or errored
 * @returns A swr object containing the requested task
 */
export function useTask(task_id: string, fallback?: ExpandedTask) {
	const session = useSession();

	return useDbQuery<ExpandedTask, TaskMutators>(task_id, {
		builder: (key) => {
			return sql.select<Task>(['*', 'board.domain AS _domain'], { from: task_id });
		},
		then: async (results: (Task & { _domain?: string })[]) => {
			const task = results?.length ? results[0] : null;
			if (!task) return task;

			// Get assignee
			if (task.assignee && task._domain)
				(task as ExpandedTask).assignee = await getMember(task._domain, task.assignee, session);

			// Delete domain temp field
			delete task._domain;

			return task as ExpandedTask;
		},

		mutators: taskMutators,
		fallback,
	});
}