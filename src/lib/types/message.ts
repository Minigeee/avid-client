import { Attachment } from './attachment';
import { Member } from './member';
import { Date } from './util';


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
	/** A list of attachments */
	attachments?: Attachment[];
	/** The time the message was created */
	created_at: Date;
	/** Indicates if this message was edited */
	edited?: boolean;
};


/** Message with expanded fields */
export type ExpandedMessage = Omit<Message, 'sender'> & {
	/** THe sender of the message */
	sender: Member | null;
};
