
/** A user profile type */
export type Profile = {
	/** Id of the profile */
	id: string;
	/** Username of the profile */
	username: string;
};

/**
 * Relations:
 * - profiles->member_of->domains
 */