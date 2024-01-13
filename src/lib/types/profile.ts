import { Domain } from './domain';
import { Date } from './util';

/**
 * Relations:
 * - profiles->member_of->domains
 */

/** A user profile type */
export type Profile = {
  /** Id of the profile */
  id: string;
  /** Username of the profile */
  username: string;
  /** Url of the profile picture image */
  profile_picture?: string | null;
  /** Url of the banner image */
  banner?: string | null;
  /** Time the profile was created */
  time_created: Date;
  /** Indicates if profile is online or not */
  online?: boolean;
};

/** Profile with expanded fields */
export type ExpandedProfile = Profile & {
  /** Domains the profile is part of */
  domains: Domain[];
};
