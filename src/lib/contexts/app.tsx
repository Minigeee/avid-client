import { createContext, PropsWithChildren, useState } from 'react';

import { RtcMutators, RtcState, useRtc } from '@/lib/hooks';


/** Holds navigation context state */
type _NavState = {
	/** The current domain the user is viewing */
	domain?: string;
	/** The ids of the current channel the user is viewing per domain */
	channels?: Record<string, string>;
	/** The ids of the expansion the user is viewing per domain */
	expansions?: Record<string, string>;
};

////////////////////////////////////////////////////////////
function navMutatorFactory(nav: _NavState, setNav: (state: _NavState) => unknown) {
	return {
		/**
		 * Switch to viewing the given domain
		 * 
		 * @param domain_id The id of the domain to switch to
		 */
		setDomain: (domain_id: string) => {
			setNav({ ...nav, domain: domain_id });
		},

		/**
		 * Switch to viewing the given channel. If a domain id is provided,
		 * then it is used, otherwise the current domain is used. If neither
		 * exist, then the function is not executed.
		 * 
		 * @param channel_id The id of the channel to switch to
		 * @param domain_id The id of the domain to switch to
		 */
		setChannel: (channel_id: string, domain_id?: string) => {
			domain_id = domain_id || nav.domain
			if (!domain_id) return;

			setNav({ ...nav, channels: { ...nav.channels, [domain_id]: channel_id } });
		},

		/**
		 * Switch to viewing the given expansion. If a domain id is provided,
		 * then it is used, otherwise the current domain is used. If neither
		 * exist, then the function is not executed.
		 * 
		 * @param expansion_id The id of the expansion to switch to
		 * @param domain_id The id of the domain to switch to
		 */
		setExpansion: (expansion_id: string, domain_id?: string) => {
			domain_id = domain_id || nav.domain
			if (!domain_id) return;

			setNav({ ...nav, expansions: { ...nav.channels, [domain_id]: expansion_id } });
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
	const [nav, setNav] = useState<_NavState>({});
	const rtc = useRtc();

	return (
		<AppContext.Provider value={{
			navigation: nav,
			rtc: rtc.rtc,
			_mutators: {
				navigation: navMutatorFactory(nav, setNav),
				rtc: rtc.mutators,
			},
		}}>
			{children}
		</AppContext.Provider>
	);
}