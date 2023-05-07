import { createContext, PropsWithChildren, useEffect, useState } from 'react';
import assert from 'assert';

import { useTimeout } from '@mantine/hooks';

import config from '@/config';
import { query, sql } from '@/lib/db';
import { RtcMutators, RtcState, useRtc, useSession } from '@/lib/hooks';
import { SessionState } from './session';


////////////////////////////////////////////////////////////
function _id(session: SessionState) {
	return `nav_states:${session.profile_id.split(':').at(-1)}`;
}

////////////////////////////////////////////////////////////
function _rmPrefix(x: Record<string, string>) {
	const remapped: Record<string, string> = {};
	for (const [k, v] of Object.entries(x))
		remapped[k.split(':').at(-1) || k] = v.split(':').at(-1) || v;
	return remapped;
}

////////////////////////////////////////////////////////////
function _addPrefix(x: Record<string, string>, kpre?: string, vpre?: string) {
	const remapped: Record<string, string> = {};
	for (const [k, v] of Object.entries(x))
		remapped[kpre ? `${kpre}:${k}` : k] = vpre ? `${vpre}:${v}` : v;
	return remapped;
}


/** Holds navigation context state */
type _NavState = {
	/** Indicates if nav state fetch is still loading */
	_loading: boolean;
	/** Indicates if remote nav state exists */
	_exists: boolean;

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

	/** Changes since last save */
	_diff: {
		domain?: string;
		channels?: Record<string, string>;
		expansions?: Record<string, string>;
	};
};

////////////////////////////////////////////////////////////
async function _saveAll(nav: _NavState, session: SessionState) {
	// Can't save without a profile
	if (!session.profile_id) return;

	// Id equal to profile id
	const id = `nav_states:${session.profile_id.split(':').at(-1)}`;

	// Update state
	const data: Omit<_NavState, '_exists' | '_loading' | '_diff' | 'board'> & { _exists: undefined; _loading: undefined } = {
		_exists: undefined,
		_loading: undefined,
		domain: nav.domain?.split(':').at(-1),
		channels: _rmPrefix(nav.channels || {}),
		expansions: _rmPrefix(nav.expansions || {}),
	};
	
	await query(
		sql.update(id, data, { merge: false }),
		{ session }
	);
}

////////////////////////////////////////////////////////////
function navMutatorFactory(nav: _NavState, setNav: (state: _NavState) => unknown, session: SessionState, save: () => void) {
	return {
		/**
		 * Switch to viewing the given domain.
		 * This function saves the new navigation state to the database.
		 * 
		 * @param domain_id The id of the domain to switch to
		 */
		setDomain: (domain_id: string) => {
			setNav({
				...nav,
				domain: domain_id,
				_diff: {
					...nav._diff,
					domain: domain_id,
				},
			});

			save();
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

			setNav({
				...nav,
				channels: {
					...nav.channels,
					[domain_id]: channel_id,
				},
				_diff: {
					...nav._diff,
					channels: {
						...nav._diff.channels,
						[domain_id]: channel_id,
					},
				}
			});

			save();
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

			setNav({ ...nav,
				expansions: {
					...nav.channels,
					[domain_id]: expansion_id,
				},
				_diff: {
					...nav._diff,
					expansions: {
						...nav._diff.channels,
						[domain_id]: expansion_id,
					},
				}
			});

			save();
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
export type AppState = {
	navigation: _NavState,
	rtc?: RtcState,
} & {
	_mutators: {
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

	const [nav, setNav] = useState<_NavState>({
		_loading: true,
		_exists: false,
		board: {
			collections: {},
			views: {},
		},
		_diff: {},
	});
	const rtc = useRtc(session);
	
	// Timeout used to save nav state
	const timeout = useTimeout(async () => {
		// Check if there is stuff to save
		if (Object.keys(nav._diff).length === 0) return;

		// Update everything in diff object
		await query(
			sql.update<_NavState>(_id(session), {
				domain: nav._diff.domain?.split(':').at(-1),
				channels: _rmPrefix(nav._diff.channels || {}),
				expansions: _rmPrefix(nav._diff.expansions || {}),
			}),
			{ session }
		);

		// Reset diff
		setNav({ ...nav, _diff: {} });
	}, config.app.nav_update_timeout);

	// Set initial nav state
	useEffect(() => {
		if (!session._exists) return;

		const id = `nav_states:${session.profile_id.split(':').at(-1)}`;
		query<(_NavState & { id: string })[]>(
			sql.select('*', { from: id }),
			{ session }
		)
			.then((results) => {
				if (results && results.length > 0) {
					const data = results[0];

					// Set state if it exists
					setNav({
						...nav,
						_loading: false,
						_exists: true,
						domain: data.domain ? `domains:${data.domain}` : undefined,
						channels: _addPrefix(data.channels || {}, 'domains', 'channels'),
						expansions: _addPrefix(data.expansions || {}, 'domains'),
					});
				}
				else {
					// Indicate that db version does not exist
					setNav({
						...nav,
						_loading: false,
						_exists: false,
					});

					// Save for initial state
					_saveAll(nav, session);
				}
			})
			.catch((error) => {
				// Indicate that db version does not exist
				setNav({
					...nav,
					_loading: false,
					_exists: false,
				});
			});
	}, [session.profile_id]);

	return (
		<AppContext.Provider value={{
			navigation: nav,
			rtc: rtc.rtc,
			_mutators: {
				navigation: navMutatorFactory(nav, setNav, session, () => {
					timeout.clear();
					timeout.start();
				}),
				rtc: rtc.mutators,
			},
		}}>
			{children}
		</AppContext.Provider>
	);
}