import { Date } from './util';
import { Member } from './member';


/** A type representing a channel message */
export type Message = {
	/** The id of the message */
	id: string;
	/** The id of the channel the message was posted to */
	channel: string;
	/** The id of the sender of the message */
	sender: string | null;
	/** The content of the message */
	message: string;
	/** The time the message was created */
	created_at: Date;
};


/** Message with expanded fields */
export type ExpandedMessage = Omit<Message, 'sender'> & {
	/** THe sender of the message */
	sender: Member | null;
};
