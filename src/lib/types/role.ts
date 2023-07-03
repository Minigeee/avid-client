
/** A type representing a domain role */
export type Role = {
	/** Id of the role */
	id: string;
	/** The id of the domain this role belongs to */
	domain: string;
	/** Label of the role */
	label: string;
	/** Role badge emote string */
	badge?: string | null;
	/** Short description for this role */
	description?: string;
}