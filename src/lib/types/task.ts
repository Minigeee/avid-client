import { Member } from './member';


/** The priority levels that can be assigned to a task */
export enum TaskPriority {
	/** Highly urgent */
	Critical,
	/** High priority */
	High,
	/** Medium priority */
	Medium,
	/** Low priority */
	Low,
	/** None or unknown priority */
	None,
}

/** A task tag */
export interface TaskTag {
	/** The sequential numeric id */
	id: number;
	/** The tag label */
	label: string;
	/** The tag color */
	color?: string;
}


/** A project task */
export type Task = {
	/** The task id */
	id: string;
	/** The sequential numeric id */
	sid: number;
	/** The id of the board the task belongs to */
	board: string;
	/** The task summary */
	summary: string;
	/** The task detailed description */
	description?: string;
	/** The completion status of this task */
	status: string;
	/** The id of the member this task is assigned to */
	assignee?: string | null;
	/** The numeric priority of the task, where higher is more important */
	priority?: TaskPriority;
	/** The cycle the task belongs to. A collection is the equivalent of s "sprint" */
	cycle?: string | null;
	/** The target due date of this task */
	due_date?: Date | null;
	/** The project category this task belongs to */
	tags?: number[] | null;
	/** A list of dependency tasks the initiation (or completion) of this task depends on */
	dependencies?: string[] | null;
	/** A list of subtasks that this parent task can be split up and delegated to */
	subtasks?: string[] | null;
	/** The time the task was created */
	time_created: Date;
	/** The time the task was last updated */
	time_updated?: Date;
	/** The time the task status was last changed */
	time_status_changed?: Date;
}

/** A task with expanded fields */
export type ExpandedTask = Omit<Task, 'assignee'> & {
	/** The member this task is assigned to */
	assignee?: Member | null;
};