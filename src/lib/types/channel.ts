
/** All possible channel types */
export type ChannelTypes = 'text' | 'rtc' | 'board';


/** Data object for each channel type */
export type ChannelData<Type extends ChannelTypes> =
	Type extends 'text' ? undefined :
	Type extends 'rtc' ? {
		/** Maximum number of participants that can join an rtc channel */
		max_participants: number;
	} :
	Type extends 'board' ? undefined :
	never;


/** Options for channel creation */
export type ChannelOptions<Type extends ChannelTypes> =
	Type extends 'text' ? {} :
	Type extends 'rtc' ? {} :
	Type extends 'board' ? {
		/** The prefix that will be passed to the board object */
		prefix: string;
	} :
	never;


/** A type representing a channel */
export interface Channel<Type extends ChannelTypes = ChannelTypes> {
	/** Id of the channel */
	id: string;
	/** The id of the domain that the channel belongs to */
	domain: string;
	/** The name of the channel */
	name: string;
	/** The type of channel */
	type: Type;
	/** Extra data for each channel type */
	data?: ChannelData<Type>;
}


/**
 * Relations:
 * - channels->channel_of->domains
 */