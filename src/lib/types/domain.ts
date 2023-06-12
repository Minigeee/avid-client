import { Channel } from './channel';
import { AllPermissions } from './permissions';
import { Role } from './role';


/** Map of resource id to permissions the user has */
export type UserPermissions = {
	/** Roles of user */
	roles: string[];
	/** Indicates if user is an admin within this permission map */
	is_admin: boolean;
	/** Indicates if user is the owner within this permission map */
	is_owner: boolean;
	/** Permissions info per resource */
	permissions: Record<string, Set<AllPermissions>>;
};


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
	/** The url of the domain icon picture */
	icon?: string | null;
	/** The url of the domain banner picture */
	banner?: string | null;
	/** Time the domain was created */
	time_created: Date;

	/** TEMP : A list of channel ids belonging to domain, used to track channel order */
	channels: string[];

	/** The default everyone role */
	_default_role: string;
}


/** Domain with expanded fields */
export type ExpandedDomain = Omit<Domain, 'roles' | 'channels'> & {
	/** Channels belonging to domain */
	channels: Channel[];
	/** A list of roles belonging to the domain */
	roles: Role[];
	/** Permissions for current user */
	_permissions: UserPermissions;
};
