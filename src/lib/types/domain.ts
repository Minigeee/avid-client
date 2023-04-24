import { Channel } from "./channel";


/**
 * Relations:
 * - profiles->member_of->domains
 * - channels->channel_of->domains
 */

/** A type representing a domain */
export type Domain = {
	/** Id of the domain */
	id: string;
	/** The name of the domain */
	name: string;
	/** A list of role ids belonging to the domain */
	roles: string[];
}


/** Domain with expanded fields */
export type ExpandedDomain = Domain & {
	/** Channels belonging to domain */
	channels: Channel[];
};
