import { Task, TaskTag } from './task';


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
	/** All tags belonging to this board */
	tags: TaskTag[];
	/** A list of task statuses that exist in this board */
	statuses: {
		/** The name or label of the status */
		label: string;
		/** The hex color of the status with '#' */
		color: string;
	}[];

	/** A counter used to assign task ids */
	_task_counter: number;
	/** A counter for assigning tag ids */
	_tag_counter: number;
}

