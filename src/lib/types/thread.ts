import { Date } from './util';


/** Text channel thread */
export type Thread = {
	/** Id of thread */
	id: string;
	/** The channel the thread belongs to */
	channel: string;
	/** Name of thread */
	name: string;
	/** The members who started the thread */
	starters: string[];
	/** The time the thread was created */
	time_created: Date;
	/** Time the thread was last active */
	last_active: Date;
};