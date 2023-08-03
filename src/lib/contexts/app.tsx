import { createContext, PropsWithChildren, useEffect, useMemo, useState } from 'react';
import assert from 'assert';

import { useTimeout } from '@mantine/hooks';

import config from '@/config';
import { useSession } from '@/lib/hooks';
import { DeepPartial, LocalAppState, RemoteAppState, RightPanelTab } from '@/lib/types';

import { SessionState } from './session';

import { merge, throttle } from 'lodash';
import { api } from '../api';
import { socket } from '../utility/realtime';


/** All subparts put together */
type _AppState = RemoteAppState & LocalAppState;

/** Remote state save func */
type SaveFunc = (state: Partial<RemoteAppState>) => void;


////////////////////////////////////////////////////////////
function remoteMutators(state: RemoteAppState, setState: (value: RemoteAppState) => void, save: SaveFunc) {
	return {
		/**
		 * Switch to viewing the given domain.
		 * This function saves the new navigation state to the database.
		 * 
		 * @param domain_id The id of the domain to switch to
		 */
		setDomain: (domain_id: string) => {
			// Don't set if already the same
			if (state.domain === domain_id) return;

			const diff = { domain: domain_id };
			setState(merge({}, state, diff));
			
			save(diff);

			// TODO : Notify change domain
			// socket().emit('general:switch-room', domain_id, nav.channels?.[domain_id] || '');
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
			domain_id = domain_id || state.domain || undefined;
			if (!domain_id) return;

			// Don't set if already the same
			if (state.channels?.[domain_id] === channel_id) return;

			const diff = {
				channels: { [domain_id]: channel_id },
			} as Partial<RemoteAppState>;
			setState(merge({}, state, diff));

			save(diff);

			// TODO : Notify change channel
			// socket().emit('general:switch-room', domain_id, channel_id);
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
			domain_id = domain_id || state.domain || undefined;
			if (!domain_id) return;

			// Don't set if already the same
			if (state.expansions?.[domain_id] === expansion_id) return;

			const diff = {
				expansions: { [domain_id]: expansion_id },
			} as Partial<RemoteAppState>;
			setState(merge({}, state, diff));

			save(diff);
		},
		
		/**
		 * Set whether the right side panel should be opened or not
		 * 
		 * @param opened Whether the panel should be opened
		 */
		setRightPanelOpened: (opened: boolean) => {
			// Don't set if already the same
			if (state.right_panel_opened === opened) return;

			const diff = { right_panel_opened: opened };
			setState({
				...state,
				right_panel_opened: opened,
			});
			
			save(diff);
		}
	};
}

////////////////////////////////////////////////////////////
function localMutators(state: LocalAppState, setState: (value: LocalAppState) => void, remote: RemoteAppState) {
	return {
		/**
		 * Mark or unmark a channel as containing stale data.
		 * 
		 * @param channel_id The channel to mark as (un)stale
		 */
		setStale: (channel_id: string, stale: boolean) => {
			// Don't set if already the same
			if (state.stale[channel_id] === stale) return;

			setState({
				...state,
				stale: { ...state.stale, [channel_id]: stale },
			});
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
			domain_id = domain_id || remote.domain || undefined;
			if (!domain_id) return;

			// Don't set if already the same
			if (state.right_panel_tab?.[domain_id] === tab) return;

			setState({
				...state,
				right_panel_tab: { ...state.right_panel_tab, [domain_id]: tab },
			});
		},
	};
}


/** App state mutators */
export type AppStateMutators = ReturnType<typeof remoteMutators> & ReturnType<typeof localMutators>;
/** Session context state */
export type AppState = _AppState & {
	/** Indicates if remote state has been loaded or not */
	_loaded: boolean;
	/** App state mutators */
	_mutators: AppStateMutators;
};

/** Session context */
// @ts-ignore
export const AppContext = createContext<AppState>();


////////////////////////////////////////////////////////////
export default function AppProvider({ children }: PropsWithChildren) {
	const session = useSession();

	// Remote state
	const [remote, setRemote] = useState<RemoteAppState>({
		domain: null,
		channels: {},
		expansions: {},
		seen: {},
		right_panel_opened: true,
	});

	// Local state
	const [local, setLocal] = useState<LocalAppState>({
		stale: {},
		right_panel_tab: {},
	});

	// Inidicate if app loaded
	const [loaded, setLoaded] = useState<boolean>(false);
	

	// Context state
	const contextState = useMemo(() => ({
		...remote,
		...local,
		_loaded: loaded,
		_mutators: {
			...remoteMutators(remote, setRemote, (state: Partial<RemoteAppState>) => {
				// Save diff
				api('POST /app', {
					body: { ...state, _merge: true },
				}, { session });
			}),
			...localMutators(local, setLocal, remote),
		},
	}), [remote, local, loaded]);

	// Load initial app state
	useEffect(() => {
		if (loaded) return;

		// Get app
		api('GET /app', {}, { session })
			.then((results) => {
				// Set remote
				if (results)
					setRemote(merge({}, remote, results));

				// Set loaded no matter if a result exists
				setLoaded(true);
			});
	}, []);


	return (
		<AppContext.Provider value={contextState}>
			{children}
		</AppContext.Provider>
	);
}