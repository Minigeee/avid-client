import { Date, WithId } from './util';
import { Label } from './common';


/** A task collection makes task management easier (used for backlog, cycles, etc.) */
export type TaskCollection = {
	/** Id of the task group */
	id: string;
	/** The name of the task group */
	name: string;
	/** Group description */
	description?: string;
	/** The start date (if the group is a cycle) */
	start_date?: Date;
	/** The end date (if the group is a cycle) */
	end_date?: Date;
};


/**
 * Relations:
 * - tasks->task_of->board
 */

/** A type representing a project board */
export interface Board {
	/** The id of the board */
	id: string;
	/** The domain the board belongs to */
	domain: string;
	/** The prefix given to all tasks in this board */
	prefix: string;
	/** Map of all tags belonging to this board */
	tags: WithId<Label>[];
	/** Map of all statuses belonging to this board */
	statuses: WithId<Label>[];
	/** Ids of all task collections belonging to the board */
	collections: TaskCollection[];

	/** A counter used to assign task ids */
	_task_counter: number;
	/** Counter used to assign unique ids to every board object except tasks */
	_id_counter: number;
}
