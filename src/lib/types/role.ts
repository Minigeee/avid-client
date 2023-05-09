import { Label } from './common';

/** A type representing a domain role */
export type Role = Label & {
	/** Id of the role */
	id: string;
	/** Short description for this role */
	description?: string;
}