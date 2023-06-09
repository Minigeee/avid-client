import { Label } from './common';

/** A type representing a domain role */
export type Role = Label & {
	/** Id of the role */
	id: string;
	/** The id of the domain this role belongs to */
	domain: string;
	/** Short description for this role */
	description?: string;
}