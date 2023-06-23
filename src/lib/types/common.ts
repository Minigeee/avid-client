import { Date } from './util';


/** A UI label type */
export type Label = {
	/** Text of the label */
	label: string;
	/** Color of the label */
	color?: string;
};


/** A domain resource (channel, board, ect.) */
export type Resource<WithName extends boolean = true> = {
	/** Id of the resource */
	id: string;
	/** The id of the domain that the resource belongs to */
	domain: string;
	/** The id of the group the resource inherits permissions from */
	inherit?: string | null;
	/** Time the resource was created */
	time_created: Date;
} & (WithName extends true ? {
	/** The name of the resource */
	name: string;
} : {});