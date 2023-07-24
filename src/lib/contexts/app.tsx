import { createContext, PropsWithChildren, useEffect, useState } from 'react';
import assert from 'assert';

import { useTimeout } from '@mantine/hooks';

import config from '@/config';
import { query, sql } from '@/lib/db';
import { RtcMutators, RtcState, useRtc, useSession } from '@/lib/hooks';
import { DeepPartial } from '@/lib/types';

import { SessionState } from './session';

import { merge } from 'lodash';


/** Get app state id from session */
function _id(session: SessionState) {
	return `app_states:${session.profile_id.split(':').at(-1)}`;
}

/** Recursively remove record parts of ids */
function _rmPrefix(x: any): any {
	if (typeof x === 'string') {
		return x.split(':').at(-1) || x;
	}

	else if (typeof x === 'object') {
		if (Array.isArray(x)) {
			return x.map(x => _rmPrefix(x));
		}
		else {
			const remapped: Record<string, string> = {};
			for (const [k, v] of Object.entries<any>(x))
				remapped[k.split(':').at(-1) || k] = _rmPrefix(v);
	
			return remapped;
		}
	}

	else {
		return x;
	}
}

////////////////////////////////////////////////////////////
function _addPrefix(x: Record<string, string>, kpre?: string, vpre?: string) {
	const remapped: Record<string, string> = {};
	for (const [k, v] of Object.entries(x))
		remapped[kpre ? `${kpre}:${k}` : k] = vpre ? `${vpre}:${v}` : v;
	return remapped;
}


/** Right panel tab values */
export type RightPanelTab = 'members' | 'activity' | 'upcoming';

/** State used for saving app state */
type _SaveState = {
	/** Indicates if app state fetch is still loading */
	_loading: boolean;
	/** Indicates if remote app state exists */
	_exists: boolean;

	/** Changes since last save */
	_diff: any;
};

/** General (miscellaneous) states */
type _GeneralState = {
	/** A map of channels to stale status */
	stale: Record<string, boolean>;

	/** Indicates if the right side panel is opened */
	right_panel_opened?: boolean;
};

/** Holds navigation context state */
type _NavState = {
	/** The current domain the user is viewing (saved) */
	domain?: string;
	/** The ids of the current channel the user is viewing per domain (saved) */
	channels?: Record<string, string>;
	/** The ids of the expansion the user is viewing per domain (saved) */
	expansions?: Record<string, string>;

	/** The right panel tab the user is viewing for each domain */
	right_panel_tab?: Record<string, RightPanelTab>;
};

/** All subparts put together */
type _AppState = {
	general: _GeneralState,
	navigation: _NavState,
	rtc?: RtcState,
};


/** Save function used to save app state */
type SaveFunc = <K extends keyof _AppState>(section: K, diff: DeepPartial<_AppState[K]>) => void;


////////////////////////////////////////////////////////////
async function _saveAll(general: _GeneralState, nav: _NavState, session: SessionState) {
	// Can't save without a profile
	if (!session.profile_id) return;

	// Id equal to profile id
	const id = _id(session);

	await query(
		sql.update(id, {
			content: {
				// General state
				general: {
					right_panel_opened: general.right_panel_opened,
				},
				// Nav state
				navigation: {
					domain: nav.domain?.split(':').at(-1),
					channels: _rmPrefix(nav.channels || {}),
					expansions: _rmPrefix(nav.expansions || {}),
				},
			}, merge: false
		}),
		{ session }
	);
}

////////////////////////////////////////////////////////////
function generalMutatorFactory(general: _GeneralState, setGeneral: (state: _GeneralState) => unknown, save: SaveFunc) {
	return {
		/**
		 * Mark or unmark a channel as containing stale data.
		 * 
		 * @param channel_id The channel to mark as (un)stale
		 */
		setStale: (channel_id: string, stale: boolean) => {
			// Don't set if already the same
			if (general.stale[channel_id] === stale) return;

			setGeneral({
				...general,
				stale: { ...general.stale, [channel_id]: stale },
			});
		},

		/**
		 * Set whether the right side panel should be opened or not
		 * 
		 * @param opened Whether the panel should be opened
		 */
		setRightPanelOpened: (opened: boolean) => {
			// Don't set if already the same
			if (general.right_panel_opened === opened) return;

			const diff = { right_panel_opened: opened };
			setGeneral({
				...general,
				right_panel_opened: opened,
			});
			
			save('general', diff);
		}
	};
}

////////////////////////////////////////////////////////////
function navMutatorFactory(nav: _NavState, setNav: (state: _NavState) => unknown, save: SaveFunc) {
	return {
		/**
		 * Switch to viewing the given domain.
		 * This function saves the new navigation state to the database.
		 * 
		 * @param domain_id The id of the domain to switch to
		 */
		setDomain: (domain_id: string) => {
			// Don't set if already the same
			if (nav.domain === domain_id) return;

			const diff = { domain: domain_id };
			setNav(merge({}, nav, diff));
			
			save('navigation', diff);
		},

		/**
		 * Switch to viewing the given channel. If a domain id is provided,
		 * then it is used, otherwise the current domain is used. If neither
		 * exist, then the function is not executed.
		 * This function saves the new navigation state to the database.
		 * 
		 * @param channel_id The id of the channel to switch to
		 * @param domain_id The id of the domain to switch to
		 */
		setChannel: (channel_id: string, domain_id?: string) => {
			domain_id = domain_id || nav.domain
			if (!domain_id) return;

			// Don't set if already the same
			if (nav.channels?.[domain_id] === channel_id) return;

			const diff: DeepPartial<_NavState> = {
				channels: { [domain_id]: channel_id },
			};
			setNav(merge({}, nav, diff));

			save('navigation', diff);
		},

		/**
		 * Switch to viewing the given expansion. If a domain id is provided,
		 * then it is used, otherwise the current domain is used. If neither
		 * exist, then the function is not executed.
		 * This function saves the new navigation state to the database.
		 * 
		 * @param expansion_id The id of the expansion to switch to
		 * @param domain_id The id of the domain to switch to
		 */
		setExpansion: (expansion_id: string, domain_id?: string) => {
			domain_id = domain_id || nav.domain
			if (!domain_id) return;

			// Don't set if already the same
			if (nav.expansions?.[domain_id] === expansion_id) return;

			const diff: DeepPartial<_NavState> = {
				expansions: { [domain_id]: expansion_id },
			};
			setNav(merge({}, nav, diff));

			save('navigation', diff);
		},

		/**
		 * Switch to viewing the given expansion. If a domain id is provided,
		 * then it is used, otherwise the current domain is used. If neither
		 * exist, then the function is not executed.
		 * 
		 * @param tab The id of the tab to switch to
		 * @param domain_id The id of the domain to switch to
		 */
		setRightPanelTab: (tab: RightPanelTab, domain_id?: string) => {
			domain_id = domain_id || nav.domain
			if (!domain_id) return;

			// Don't set if already the same
			if (nav.right_panel_tab?.[domain_id] === tab) return;

			const diff: DeepPartial<_NavState> = {
				right_panel_tab: { [domain_id]: tab },
			};
			setNav(merge({}, nav, diff));
		},
	};
}


/** Session context state */
export type AppState = _SaveState & _AppState & {
	_mutators: {
		general: ReturnType<typeof generalMutatorFactory>,
		navigation: ReturnType<typeof navMutatorFactory>,
		rtc: RtcMutators,
	}
};

/** Session context */
// @ts-ignore
export const AppContext = createContext<AppState>();


////////////////////////////////////////////////////////////
export default function AppProvider({ children }: PropsWithChildren) {
	const session = useSession();

	const [save, setSave] = useState<_SaveState>({
		_loading: true,
		_exists: false,
		_diff: {},
	});

	const [general, setGeneral] = useState<_GeneralState>({
		stale: {},
	});
	const [nav, setNav] = useState<_NavState>({});
	const rtc = useRtc(session);

	// Use separate saved state to merge with latest values
	const [savedState, setSavedState] = useState<DeepPartial<_AppState> | null>(null);

	
	// Timeout used to save nav state
	const timeout = useTimeout(async () => {
		// Check if there is stuff to save
		if (Object.keys(save._diff).length === 0) return;

		// Update everything in diff object
		await query(
			sql.update<_AppState>(_id(session), {
				content: _rmPrefix(save._diff),
			}),
			{ session }
		);

		// Reset diff
		setSave({ ...save, _diff: {} });
	}, config.app.nav_update_timeout);
	
	// Save function
	const saveFunc: SaveFunc = (section, diff) => {
		// Set diff
		const netDiff = { [section]: diff };
		setSave({ ...save, _diff: merge(save._diff, netDiff) });

		// Start save timer
		timeout.clear();
		timeout.start();
	};

	// Set initial nav state
	useEffect(() => {
		if (!session._exists) return;

		// Initial save state for fallback
		const initialSave: DeepPartial<_AppState> = {
			general: {
				right_panel_opened: true,
			},
		};

		const id = _id(session);
		query<(_AppState & { id: string })[]>(
			sql.select('*', { from: id }),
			{ session }
		)
			.then((results) => {
				const _exists = results && results.length > 0 || false;
				if (results && _exists) {
					const data = results[0];

					const remoteNav = data.navigation || {};

					// Set saved state (this is async function so the initial state values may be stale)
					setSavedState({
						general: {
							right_panel_opened: data.general?.right_panel_opened === undefined ? true : data.general.right_panel_opened,
						},
						navigation: {
							domain: remoteNav.domain ? `domains:${remoteNav.domain}` : undefined,
							channels: _addPrefix(remoteNav.channels || {}, 'domains', 'channels'),
							expansions: _addPrefix(remoteNav.expansions || {}, 'domains'),
						},
					});
				}
				else {
					// Save doesn't exist on db, save to push initial state
					_saveAll({ ...general, ...initialSave?.general } as _GeneralState, nav, session);
				}

				// Set save state
				setSave(merge({}, initialSave, save, { _exists, _loading: false }));
			})
			.catch((error) => {
				// Indicate that db version does not exist
				setSave(merge({}, save, initialSave, { _exists: false, _loading: false }));
			});
	}, [session.profile_id]);

	// Merge save state with initial values
	useEffect(() => {
		if (!savedState) return;

		setGeneral(merge({}, general, savedState.general || {}));
		setNav(merge({}, nav, savedState.navigation || {}));

		setSavedState(null);
	}, [savedState]);


	return (
		<AppContext.Provider value={{
			...save,
			general,
			navigation: nav,
			rtc: rtc.rtc,
			_mutators: {
				general: generalMutatorFactory(general, setGeneral, saveFunc),
				navigation: navMutatorFactory(nav, setNav, saveFunc),
				rtc: rtc.mutators,
			},
		}}>
			{children}
		</AppContext.Provider>
	);
}