import { Resource } from './common';
import { ExpandedPrivateMember } from './member';
import { Date } from './util';

/** All possible channel types */
export type ChannelTypes = 'text' | 'rtc' | 'board' | 'calendar' | 'wiki';

/** Data object for each channel type */
export type ChannelData<Type extends ChannelTypes> = Type extends 'text'
  ? undefined
  : Type extends 'rtc'
    ? {
        /** Maximum number of participants that can join an rtc channel */
        max_participants: number;
        /** Current participants (ids) in the room */
        participants: string[];
      }
    : Type extends 'board'
      ? {
          /** The id of the board */
          board: string;
        }
      : never;

/** Options for channel creation */
export type ChannelOptions<Type extends ChannelTypes> = Type extends 'text'
  ? {}
  : Type extends 'rtc'
    ? {}
    : Type extends 'board'
      ? {
          /** The prefix that will be passed to the board object */
          prefix: string;
        }
      : never;

/** A type representing a channel */
export type Channel<Type extends ChannelTypes = ChannelTypes> = Resource & {
  /** The type of channel */
  type: Type;
  /** Extra data for each channel type */
  data?: ChannelData<Type>;
  /** Time the latest event occurred */
  _last_event: Date;
};

/** A group containing a list of channels */
export type ChannelGroup = {
  /** Id of the channel group */
  id: string;
  /** The id of the domain that the group belongs to */
  domain: string;
  /** The name of the group */
  name: string;
  /** A list of channels that belong to the group (in order) */
  channels: string[];
  /** Time the channel was created */
  time_created: Date;
};

/** Expanded channel group */
export type ExpandedChannelGroup = Omit<ChannelGroup, 'channels'> & {
  /** A list of channels that belong to the group (in order) */
  channels: Channel[];
};

/**
 * Relations:
 * - channels->channel_of->domains
 */


/** Private channel (i.e. for dms) */
export type PrivateChannel = {
  /** Id of the private channel */
  id: string;
  /** The name of the group */
  name?: string;
  /** Determines if more than two users can participate */
  multi_member: boolean;
  /** Time the channel was created */
  time_created: Date;
  /** Time the latest event occurred */
  _last_event: Date;
};

/** Private channel with extra fields */
export type ExpandedPrivateChannel = PrivateChannel & {
  /** Ids of members in the channel */
  members: string[];
};

/**
 * Relations:
 * - profiles->private_member_of->private_channels
 */