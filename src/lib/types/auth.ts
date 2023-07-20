
/** Access token payload */
export type AccessToken = {
	/** User id */
	user_id: string;
	/** Current profile id */
	profile_id: string;
	/** An email associated with user */
	email?: string;
};