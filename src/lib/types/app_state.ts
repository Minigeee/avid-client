

/** Right panel tab values */
export type RightPanelTab = 'members' | 'activity' | 'upcoming';

/** App state that gets saved to database */
export type RemoteAppState = {
	/** The current domain the user is viewing (saved) */
	domain: string | null;
	/** The ids of the current channel the user is viewing per domain (saved) */
	channels: Record<string, string>;
	/** The ids of the expansion the user is viewing per domain (saved) */
	expansions: Record<string, string>;

	/** A map of domains to channels to "seen" state */
	seen: Record<string, Record<string, boolean>>;
	/** A map of channels to number of pings */
	pings?: Record<string, number>;
	/** Indicates if the right side panel is opened */
	right_panel_opened?: boolean;
};

/** App state that is only tracked locally within a single session */
export type LocalAppState = {
	/** A map of channels to stale status */
	stale: Record<string, boolean>;
	/** The right panel tab the user is viewing for each domain */
	right_panel_tab: Record<string, RightPanelTab>;
};
