import { Channel } from './channel';
import { Role } from './role';


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
	/** Time the domain was created */
	time_created: Date;

	/** TEMP : A list of channel ids belonging to domain, used to track channel order */
	channels: string[];
}


/** Domain with expanded fields */
export type ExpandedDomain = Omit<Domain, 'roles' | 'channels'> & {
	/** Channels belonging to domain */
	channels: Channel[];
	/** A list of roles belonging to the domain */
	roles: Role[];
};
