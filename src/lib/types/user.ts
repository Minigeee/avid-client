import { ProfileId, UserId } from './db';

/** A user object is associated with an account and can have multiple profiles */
export type User = {
	/** User id */
	id: UserId;

	/** The string id given by a provider when a user authenticates themselves */
	provider_id: string;
	/** The provider that is used for the user account */
	provider: string;
	/** A list of user profile ids */
	profiles: ProfileId[];
	/** The email associated with the user */
	email?: string;

	/** The id of the currently active user profile */
	current_profile?: ProfileId | null;

	/** Key used to verify id token */
	_id_key: string;
};