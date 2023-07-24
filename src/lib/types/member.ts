import { Date } from './util';


/** A type representing a domain member */
export type Member = {
	/** Profile id */
	id: string;
	/** The member's alias within this domain */
	alias: string;
	/** A list of role ids assigned to the member */
	roles?: string[];
	/** Time the user joined the domain */
	time_joined: Date;
	/** Indicates if member is the domain owner */
	is_owner?: boolean;
	/** Indicates if member is a domain admin */
	is_admin?: boolean;
	/** Tracks the number of times this member was pinged */
	_mentions?: number;
	/** Tracks the last time this member was pinged to "dedupe" additions to the ping counter */
	_last_mentioned?: number;
};


/** Member with more fields */
export type ExpandedMember = Member & {
	/** The url of the profile picture of the member */
	profile_picture?: string | null;
	/** Indicates if the member is online */
	online?: boolean;
};