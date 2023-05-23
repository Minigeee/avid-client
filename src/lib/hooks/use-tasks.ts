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
			 * @param optimistic Indicates if optimistic update should be performed
			 * @returns A board object with the updated task
			 */
			updateTask: (task_id: string, task: Partial<ExpandedTask>, optimistic: boolean = false) => mutate(
				swrErrorWrapper(async (tasks: ExpandedTask[]) => {
					if (task.id !== undefined) delete task.id;
					if (task.sid !== undefined) delete task.sid;
					if (task.board !== undefined) delete task.board;

					// Time the task is updated
					const now = new Date().toISOString();

					// Check if status changed
					const statusUpdated = task.status && task.status !== tasks.find(x => x.id === task_id)?.status;

					// Update task
					const results = await query<(Task & { _domain: string })[]>(
						sql.update<Task>(task_id, {
							content: {
								..._sanitize(task),
								assignee: task.assignee === null ? null : task.assignee?.id,
								time_updated: now,
								time_status_updated: statusUpdated ? now : undefined,
							},
							return: ['*', 'board.domain AS _domain'],
						}),
						{ session }
					);
					assert(results && results.length > 0);

					// Get assignee
					const assignee = results[0].assignee ? await getMember(results[0]._domain, results[0].assignee, session) : null;

					// Create new updated task list
					const copy = tasks.slice();
					const index = copy.findIndex(x => x.id === task_id);
					copy[index] = _sanitize({
						...results[0],
						assignee,
						_domain: undefined,
					});

					// Mutate task hook
					_mutate(task_id, copy[index], { revalidate: false });

					return copy;
				}, { message: 'An error occurred while modifying task' }),
				{
					optimisticData: optimistic ? (tasks) => {
						if (!tasks) return [];

						// Find index
						const idx = tasks.findIndex(x => x.id === task_id);
						if (idx < 0) return tasks;

						const copy = tasks.slice();
						copy[idx] = { ...copy[idx], ...task };
						return copy;
					} : undefined,
					revalidate: false,
				}
			),

			/**
			 * Update a list of tasks object within the board with the same data
			 * 
			 * @param task_ids A list of task ids to update
			 * @param task A task object with updated properties
			 * @param optimistic Indicates if optimistic update should be performed
			 * @returns A board object with the updated tasks
			 */
			updateTasks: (task_ids: string[], task: Partial<ExpandedTask>, optimistic: boolean = false) => mutate(
				swrErrorWrapper(async (tasks: ExpandedTask[]) => {
					if (task.id !== undefined) delete task.id;
					if (task.sid !== undefined) delete task.sid;
					if (task.board !== undefined) delete task.board;

					// Time the task is updated
					const now = new Date().toISOString();

					// Extract status value for sql update
					const newStatus = task.status;

					// Update task
					const results = await query<[Task[], Board[]]>(sql.multi([
						sql.update<Task>(task_ids, {
							content: {
								..._sanitize(task),
								assignee: task.assignee === null ? null : task.assignee?.id,
								time_updated: now,
								time_status_updated: sql.fn<Task>('update_tasks', function () {
									return newStatus && newStatus !== this.status ? now : this.time_status_updated;
								}, { newStatus, now }),
							},
						}),
						sql.select<Board>(['domain'], { from: board_id }),
					]), { session, complete: true }
					);
					assert(results);

					const newTasks = results[0];
					const { domain } = results[1][0];
			
					// Get map of assignees
					const assignees: Record<string, Member | null> = {};
					for (const task of newTasks) {
						if (task.assignee)
							assignees[task.assignee] = null;
					}
			
					// Get members
					const members = await getMembers(domain, Object.keys(assignees), session);
					for (const member of members)
						assignees[member.id] = member;

					// Map of tasks that are updated
					const updatedTasks: Record<string, ExpandedTask> = {};
					for (const updated of newTasks) {
						updatedTasks[updated.id] = {
							...updated,
							assignee: updated.assignee ? assignees[updated.assignee] : null,
						};
					}

					// Mutate task hooks
					for (const [id, x] of Object.entries(updatedTasks))
						_mutate(id, x, { revalidate: false });

					// Create new updated task list
					const newList = tasks.map(x => updatedTasks[x.id] || x);

					return newList;
				}, { message: 'An error occurred while modifying task' }),
				{
					optimisticData: optimistic ? (tasks) => {
						if (!tasks) return [];

						// Make set of ids updated
						const ids = new Set<string>(task_ids);

						// Create new updated task list
						const newList = tasks.map(x => ids.has(x.id) ? { ...x, ...task } : x);

						return newList;
					} : undefined,
					revalidate: false,
				}
			),

			/**
			 * Remove a list of tasks from the board object
			 * 
			 * @param task_ids A list of tasks to remove
			 * @returns The new board object
			 */
			removeTasks: (task_ids: string[]) => mutate(
				swrErrorWrapper(async (tasks: ExpandedTask[]) => {
					// Send delete task
					await query(sql.delete(task_ids), { session });

					const ids = new Set<string>(task_ids);
					return tasks.filter(x => !ids.has(x.id));
				}, { message: 'An error occurred while deleting tasks' }),
				{
					revalidate: false,
					rollbackOnError: true,
					optimisticData: (tasks) => {
						const ids = new Set<string>(task_ids);
						return tasks?.filter(x => !ids.has(x.id)) || [];
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