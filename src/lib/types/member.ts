import { Date } from './util';


/** A type representing a domain member */
export type Member = {
	/** Profile id */
	id: string;
	/** The member's alias within this domain */
	alias: string;
	/** A list of role ids assigned to the member */
	roles?: string[];
	/** The color the member should be displayed in, taken from their top role (this isn't stored in database) */
	color?: string;
	/** Time the user joined the domain */
	time_joined: Date;
	/** Tracks the number of times this member was pinged */
	_mentions?: number;
	/** Tracks the last time this member was pinged to "dedupe" additions to the ping counter */
	_last_mentioned?: number;
}