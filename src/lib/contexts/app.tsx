import {
  createContext,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import assert from 'assert';

import { useTimeout } from '@mantine/hooks';

import config from '@/config';
import { useSession } from '@/lib/hooks';
import {
  DeepPartial,
  ExpandedProfile,
  LocalAppState,
  Profile,
  RemoteAppState,
  RightPanelTab,
} from '@/lib/types';

import { SessionState } from './session';

import { merge, throttle } from 'lodash';
import { api } from '../api';
import { socket } from '../utility/realtime';
import { id } from '../db';

/** All subparts put together */
type _AppState = RemoteAppState & LocalAppState;

/** Remote state save func */
type SaveFunc = (state: Partial<RemoteAppState>) => void;

////////////////////////////////////////////////////////////
function remoteMutators(
  state: RemoteAppState,
  setState: (value: RemoteAppState) => void,
  save: SaveFunc,
) {
  return {
    /** For updating entire state */
    setRemote: setState,

    /**
     * Switch to the given view.
     *
     * @param view The view to switch to
     */
    setView: (view: RemoteAppState['view']) => {
      // Don't set if already the same
      if (state.view === view) return;

      const diff = { view } as Partial<RemoteAppState>;
      setState(merge({}, state, diff));

      save(diff);
    },

    /**
     * Switch to viewing the given domain.
     * This function saves the new navigation state to the database.
     *
     * @param domain_id The id of the domain to switch to
     */
    setDomain: (domain_id: string) => {
      // Don't set if already the same
      if (state.domain === domain_id && state.view === 'main') return;

      const diff: Partial<RemoteAppState> = {
        view: 'main',
        domain: domain_id,
      };

      // Mark as seen
      const channel_id = state.channels[domain_id];
      if (channel_id) {
        diff.last_accessed = {
          [domain_id]: {
            [channel_id]: new Date().toISOString(),
          },
        };

        // Reset pings
        if (state.pings?.[channel_id]) diff.pings = { [channel_id]: 0 };
      }

      setState(merge({}, state, diff));

      // Don't save using standard method, switch room will handle that for use

      if (channel_id)
        socket().emit('general:switch-room', domain_id, channel_id);
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
        last_accessed: {
          [domain_id]: { [channel_id]: new Date().toISOString() },
        },
        pings: { [channel_id]: 0 },
      } as Partial<RemoteAppState>;
      setState(merge({}, state, diff));

      // Don't save using standard method, switch room will handle that for use

      socket().emit('general:switch-room', domain_id, channel_id);
    },

    /**
     * Switch to view a certain private channel (dm).
     * If the user is not in the dm view, they are switched to it.
     *
     * @param channel_id The id of the channel to switch to
     */
    setPrivateChannel: (channel_id: string) => {
      // Don't switch if already viewing
      if (state.private_channel === channel_id && state.view === 'dm') return;

      // Set new state
      const diff = {
        view: 'dm',
        private_channel: channel_id,
      } as Partial<RemoteAppState>;
      setState(merge({}, state, diff));

      // Save
      save(diff);
    },

    /**
     * Updates the ping counter for a channel locally. Does not update the
     * database state.
     *
     * @param domain_id The domain of the channel
     * @param channel_id The channel to set the ping counter for
     * @param count The new ping counter value
     */
    setPings: (channel_id: string, count: number) => {
      if (state.pings?.[channel_id] === count) return;

      setState({
        ...state,
        pings: {
          ...state.pings,
          [channel_id]: count,
        },
      });
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
    },

    /**
     * Set the private channel state by merging
     *
     * @param channel_id The id of the private channel state to save
     * @param chatState The new channel state values that should be set
     */
    setPrivateChannelState: (
      channel_id: string,
      channelState: Partial<
        NonNullable<RemoteAppState['private_channel_states']>[string]
      >,
    ) => {
      const diff = {
        private_channel_states: { [id(channel_id)]: channelState },
      } as Partial<RemoteAppState>;
      setState(merge({}, state, diff));

      save(diff);
    },

    /**
     * Set the chat state by merging
     *
     * @param channel_id The id of the chat state to save
     * @param chatState The new board state values that should be set
     */
    setChatState: (
      chat_id: string,
      chatState: Partial<NonNullable<RemoteAppState['chat_states']>[string]>,
    ) => {
      const diff = {
        chat_states: { [id(chat_id)]: chatState },
      } as Partial<RemoteAppState>;
      setState(merge({}, state, diff));

      save(diff);
    },

    /**
     * Set the board state by merging
     *
     * @param board_id The id of the board state to save
     * @param boardState The new board state values that should be set
     */
    setBoardState: (
      board_id: string,
      boardState: Partial<NonNullable<RemoteAppState['board_states']>[string]>,
    ) => {
      const diff = {
        board_states: { [id(board_id)]: boardState },
      } as Partial<RemoteAppState>;
      setState(merge({}, state, diff));

      save(diff);
    },
  };
}

////////////////////////////////////////////////////////////
function localMutators(
  state: LocalAppState,
  setState: (value: LocalAppState) => void,
  remote: RemoteAppState,
) {
  return {
    /** For updating entire state */
    setLocal: setState,

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
    
    /**
     * Set the new private channel info
     * 
     * @param profile The profile to start a new channel with (single dm)
     */
    setNewPrivateChannel: (profile: Profile | null) => {
      // Don't set if profile id already matches
      if (state.new_private_channel?.id === profile?.id) return;

      setState({
        ...state,
        new_private_channel: profile,
      });
    }
  };
}

/** App state mutators */
export type AppStateMutators = ReturnType<typeof remoteMutators> &
  ReturnType<typeof localMutators>;
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
export default function AppProvider({
  children,
  ...props
}: PropsWithChildren & { initial?: RemoteAppState }) {
  const session = useSession();

  // Remote state
  const [remote, setRemote] = useState<RemoteAppState>(
    merge(
      {
        view: 'main' as RemoteAppState['view'],
        domain: null,
        channels: {},
        private_channel: null,
        last_accessed: {},
        right_panel_opened: true,
      },
      props.initial || {},
    ),
  );

  // Local state
  const [local, setLocal] = useState<LocalAppState>({
    stale: {},
    right_panel_tab: {},
  });

  // Inidicate if app loaded
  const [loaded, setLoaded] = useState<boolean>(props.initial !== undefined);

  // Save function
  const diffRef = useRef<Partial<RemoteAppState>>({});
  const _api = useCallback(
    throttle(
      () => {
        // Update using websocket
        socket().emit('general:update-app-state', diffRef.current);

        // Reset
        diffRef.current = {};
      },
      1000,
      { trailing: true },
    ),
    [],
  );
  const save = useCallback((state: Partial<RemoteAppState>) => {
    merge(diffRef.current, state);
    _api();
  }, []);

  // Context state
  const contextState = useMemo(
    () => ({
      ...remote,
      ...local,
      _loaded: loaded,
      _mutators: {
        ...remoteMutators(remote, setRemote, save),
        ...localMutators(local, setLocal, remote),
      },
    }),
    [remote, local, loaded],
  );

  // Load initial app state
  useEffect(() => {
    if (loaded) return;

    // Get app
    api('GET /app', {}, { session }).then((results) => {
      // Set remote
      if (results) setRemote(merge({}, remote, results));

      // Set loaded no matter if a result exists
      setLoaded(true);
    });
  }, []);

  return (
    <AppContext.Provider value={contextState}>{children}</AppContext.Provider>
  );
}
