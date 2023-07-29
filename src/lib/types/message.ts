import { Attachment } from './attachment';
import { Member } from './member';
import { Date } from './util';


/** A single reaction object */
export type Reaction = {
	/** The emoji id */
	emoji: string;
};

/** Reactions aggregated into single object */
export type AggregatedReaction = {
	/** The emoji id */
	emoji: string;
	/** The number of people that used this emoji */
	count: number;
	/** Indicates if the user sent this reaction emoji (1 if so, 0 if not) */
	self?: number;
};


/** A type representing a channel message */
export type Message = {
	/** The id of the message */
	id: string;
	/** The id of the channel the message was posted to */
	channel: string;
	/** The id of the sender of the message */
	sender: string | null;
	/** The id of the message this message is replying to */
	reply_to?: string;
	/** The id of the thread the message belongs to, if it exists */
	thread?: string;
	/** Indicates if the message is pinned in its channel */
	pinned?: boolean;
	/** The content of the message */
	message: string;
	/** A list of attachments */
	attachments?: Attachment[];
	/** A list of mentions found in the message */
	mentions?: {
		/** Member mentions */
		members?: string[];
		/** Role mentions */
		roles?: string[];
	};
	/** The time the message was created */
	created_at: Date;
	/** Indicates if this message was edited */
	edited?: boolean;
};

/** Message with expanded fields */
export type ExpandedMessage = Omit<Message, 'sender' | 'reply_to'> & {
	/** The sender of the message */
	sender: Member | null;
	/** The message this message is replying to */
	reply_to?: ExpandedMessage;
	/** A list of reactions attached to this message */
	reactions?: AggregatedReaction[];
};
