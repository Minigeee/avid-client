import { Domain } from "./domain";


/**
 * Relations:
 * - profiles->member_of->domains
 */

/** A user profile type */
export type Profile = {
	/** Id of the profile */
	id: string;
	/** Username of the profile */
	username: string;
};


/** Profile with expanded fields */
export type ExpandedProfile = Profile & {
	/** Domains the profile is part of */
	domains: Domain[];
};
