import { Date } from './util';
import { Member } from './member';


/** The priority levels that can be assigned to a task */
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

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
	priority?: TaskPriority | null;
	/** The group the task belongs to */
	group?: string | null;
	/** The target due date of this task */
	due_date?: Date | null;
	/** A list of tag ids on this task */
	tags?: string[] | null;
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