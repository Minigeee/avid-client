import useSWR, { KeyedMutator, mutate as _mutate } from 'swr';
import assert from 'assert';

import config from '@/config';
import { api } from '@/lib/api';
import { SessionState } from '@/lib/contexts';
import { ExpandedTask } from '@/lib/types';

import { swrErrorWrapper } from '@/lib/utility/error-handler';

import { SwrWrapper } from './use-swr-wrapper';

import sanitizeHtml from 'sanitize-html';
import { useApiQuery } from './use-api-query';
import { setMembers } from './use-members';


////////////////////////////////////////////////////////////
function _sanitize<T extends Partial<ExpandedTask>>(task: T) {
	if (task.description)
		task.description = sanitizeHtml(task.description, config.sanitize);

	return task;
}


////////////////////////////////////////////////////////////
function tasksMutators(mutate: KeyedMutator<ExpandedTask[]>, session: SessionState | undefined, board_id: string) {
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
				const results = await api('POST /tasks', {
					body: {
						...task,
						board: board_id,
						assignee: task.assignee?.id,
					},
				}, { session });

				return [
					...tasks, _sanitize({
						...results,
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

				// Update task
				const results = await api('PATCH /tasks/:task_id', {
					params: { task_id },
					body: {
						...task,
						assignee: task.assignee?.id,
					},
				}, { session });

				// Create new updated task list
				const copy = tasks.slice();
				const index = copy.findIndex(x => x.id === task_id);
				copy[index] = _sanitize({
					...results,
					assignee: task.assignee,
				});

				// Mutate task hook
				if (!optimistic)
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
					copy[idx] = _sanitize({ ...copy[idx], ...task });

					// Optimistic update for single hook
					_mutate(task_id, copy[idx], { revalidate: false });

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

				// Update tasks
				const results = await api('PATCH /tasks', {
					body: {
						update: task_ids.map((id) => ({
							id,
							...task,
							assignee: task.assignee?.id,
						})),
					},
				}, { session });
				assert(results.updated);

				// Map of tasks that are updated
				const updatedTasks: Record<string, ExpandedTask> = {};
				for (const updated of results.updated) {
					updatedTasks[updated.id] = {
						...updated,
						assignee: task.assignee,
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
				// Delete tasks
				await api('PATCH /tasks', {
					body: {
						delete: task_ids,
					},
				}, { session });

				// Remove tasks
				const ids = new Set<string>(task_ids);
				const newTasks = tasks.filter(x => !ids.has(x.id));

				// Remove refs of these tasks from subtask and dep lists
				for (let i = 0; i < newTasks.length; ++i) {
					const task = newTasks[i];

					let needsSubtaskFilter = false;
					for (const id of task.subtasks || []) {
						if (ids.has(id)) {
							needsSubtaskFilter = true;
							break;
						}
					}

					let needsDepFilter = false;
					for (const id of task.dependencies || []) {
						if (ids.has(id)) {
							needsDepFilter = true;
							break;
						}
					}

					// Continue if no update needed
					if (!needsSubtaskFilter && !needsDepFilter) continue;

					// Replace object
					newTasks[i] = {
						...task,
						subtasks: needsSubtaskFilter ? task.subtasks?.filter(id => !ids.has(id)) : task.subtasks,
						dependencies: needsDepFilter ? task.dependencies?.filter(id => !ids.has(id)) : task.dependencies,
					} as ExpandedTask;
				}

				return newTasks;
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


/** Mutators that will be attached to the board swr wrapper */
export type TasksMutators = ReturnType<typeof tasksMutators>;
/** Swr data wrapper for a domain object */
export type TasksWrapper<Loaded extends boolean = true> = SwrWrapper<ExpandedTask[], Loaded, TasksMutators>;

/**
 * A swr hook that performs a db query to retrieve tasks from a project board.
 * All fields are retrieved except `description`, `board`, `time_updated`, and `time_status_changed`.
 * 
 * @param board_id The id of the board to retrieve tasks from
 * @param domain_id The id of the domain the board belongs to, used to fetch and cache assignees
 * @returns A swr object containing the requested tasks
 */
export function useTasks(board_id: string | undefined, domain_id: string) {
	return useApiQuery(board_id ? `${board_id}.tasks` : undefined, 'GET /tasks', {
		query: { board: board_id || '' }
	}, {
		then: (results) => {
			// Cache members
			setMembers(domain_id, Object.values(results.members), { override_online: false });

			return results.tasks.map((task) => ({ ...task, assignee: task.assignee ? results.members[task.assignee] : null })) as ExpandedTask[];
		},
		mutators: tasksMutators,
		mutatorParams: [board_id],
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


/** Map of individual tasks that were loaded (board id to task list) */
const _singleTasks: Record<string, Set<string>> = {};

/**
 * A swr hook that performs a db to retrieve a task.
 * 
 * @param task_id The id of the task to retrieve
 * @param fallback The optional fallback task data to display while task is loading or errored
 * @returns A swr object containing the requested task
 */
export function useTask(task_id: string, fallback?: ExpandedTask) {
	return useApiQuery(task_id, 'GET /tasks/:task_id', {
		params: { task_id },
	}, {
		then: (results) => {
			if (!_singleTasks[results.board])
				_singleTasks[results.board] = new Set<string>();
			_singleTasks[results.board].add(results.id);

			return results;
		},
		mutators: taskMutators,
		fallback,
	})
}


/** Get the set of tasks that have been loaded indivudually for a certain board */
export function getLoadedSingleTasks(board_id: string): Set<string> | null {
	return _singleTasks[board_id] || null;
}