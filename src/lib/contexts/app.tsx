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
};

/** Holds navigation context state */
type _NavState = {
	/** The current domain the user is viewing */
	domain?: string;
	/** The ids of the current channel the user is viewing per domain */
	channels?: Record<string, string>;
	/** The ids of the expansion the user is viewing per domain */
	expansions?: Record<string, string>;
	
	/** Board navigation states */
	board: {
		/** The collection the user is viewing per board id */
		collections: Record<string, string>;
		/** The board view the user is viewing per board id */
		views: Record<string, 'list' | 'kanban'>;
	};
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
async function _saveAll(nav: _NavState, session: SessionState) {
	// Can't save without a profile
	if (!session.profile_id) return;

	// Id equal to profile id
	const id = _id(session);

	await query(
		sql.update(id, {
			content: {
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
			setNav(merge(nav, diff));
			
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
			setNav(merge(nav, diff));

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
			setNav(merge(nav, diff));

			save('navigation', diff);
		},
		
		/** Board navigation mutators */
		board: {
			/**
			 * Set the collection the user is viewing for a certain board
			 * 
			 * @param board_id The board to set the current value for
			 * @param collection_id The id of the collection the user is viewing
			 */
			setCollection: (board_id: string, collection_id: string) => {
				// Set state
				setNav({
					...nav,
					board: {
						...nav.board,
						collections: {
							...nav.board.collections,
							[board_id]: collection_id,
						},
					},
				});
			},

			/**
			 * Set the board view the user is using for a certain board
			 * 
			 * @param board_id The board to set the current value for
			 * @param view The view the user is using
			 */
			setView: (board_id: string, view: 'list' | 'kanban') => {
				// Set state
				setNav({
					...nav,
					board: {
						...nav.board,
						views: {
							...nav.board.views,
							[board_id]: view,
						},
					},
				});
			},
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
	const [nav, setNav] = useState<_NavState>({
		board: {
			collections: {},
			views: {},
		},
	});
	const rtc = useRtc(session);
	
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

		const id = _id(session);
		query<(_AppState & { id: string })[]>(
			sql.select('*', { from: id }),
			{ session }
		)
			.then((results) => {
				const _exists = results && results.length > 0 || false;
				if (results && _exists) {
					const data = results[0];

					// Set state if it exists
					const remoteNav = data.navigation || {};
					setNav({
						...nav,
						domain: remoteNav.domain ? `domains:${remoteNav.domain}` : undefined,
						channels: _addPrefix(remoteNav.channels || {}, 'domains', 'channels'),
						expansions: _addPrefix(remoteNav.expansions || {}, 'domains'),
					});
				}
				else {
					// Save doesn't exist on db, save to push initial state
					_saveAll(nav, session);
				}

				// Set save state
				setSave({ ...save, _exists, _loading: false });
			})
			.catch((error) => {
				// Indicate that db version does not exist
				setSave({ ...save, _exists: false, _loading: false });
			});
	}, [session.profile_id]);

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