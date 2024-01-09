import { ExpandedPrivateMember } from './member';
import { ExpandedProfile, Profile } from './profile';
import { Date } from './util';

/** Right panel tab values */
export type RightPanelTab = 'members' | 'activity' | 'upcoming';

/** App state that gets saved to database */
export type RemoteAppState = {
  /** Current view (main, dms, etc.) */
  view: 'main' | 'dm';
  /** The current domain the user is viewing (saved) */
  domain: string | null;
  /** The ids of the current channel the user is viewing per domain (saved) */
  channels: Record<string, string>;
  /** The current private channel being viewed (dm) */
  private_channel: string | null;

  /** A map of channels to the time they were last accessed */
  last_accessed: Record<string, Record<string, Date>>;
  /** A map of channels to number of pings */
  pings?: Record<string, number>;
  /** A map of private channels to number of pings */
  private_pings?: Record<string, number>;
  /** Indicates if the right side panel is opened */
  right_panel_opened?: boolean;
  
  /** Private channel states */
  private_channel_states?: Record<
    string,
    {
      /** If the side panel is opened */
      side_panel_opened?: boolean;
    }
  >;

  /** Chat room states */
  chat_states?: Record<
    string,
    {
      /** If the side panel is opened */
      side_panel_opened?: boolean;
    }
  >;
  /** Current state for task boards */
  board_states?: Record<
    string,
    {
      /** The view type for each collection */
      view?: Record<string, string>;
      /** The grouper for each collection */
      group_by?: Record<string, string | null>;
    }
  >;
};

/** App state that is only tracked locally within a single session */
export type LocalAppState = {
  /** A map of channels/domains to stale status */
  stale: Record<string, boolean>;
  /** The right panel tab the user is viewing for each domain */
  right_panel_tab: Record<string, RightPanelTab>;
  /** Whenever user starts a new private channel, but no message is actually sent yet */
  new_private_channel?: Profile | null;
};
