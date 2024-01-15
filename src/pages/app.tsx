import { NextRouter, useRouter } from 'next/router';
import { useEffect, useMemo } from 'react';

import {
  Center,
  DEFAULT_THEME,
  Loader,
  MantineProvider,
  MantineThemeOverride,
  ScrollArea,
  Tuple,
} from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';

import { modals } from '@/lib/ui/modals';
import ErrorBoundary from '@/lib/ui/components/ErrorBoundary';
import RtcVoices from '@/lib/ui/components/rtc/RtcVoices';
import CreateProfile from '@/lib/ui/screens/CreateProfile';
import Main from '@/lib/ui/screens/Main';
import JoinDomain from '@/lib/ui/screens/JoinDomain';
import ConfirmModal from '@/lib/ui/modals/ConfirmModal';

import config from '@/config';
import AppProvider from '@/lib/contexts/app';
import { RtcProvider } from '@/lib/contexts';
import {
  setDomainDefault,
  setMemberQuery,
  setMembers,
  setProfileDefault,
  useCurrentProfile,
  useProfile,
  useRtc,
  useSession,
} from '@/lib/hooks';
import { connect, useRealtimeHandlers } from '@/lib/utility/realtime';
import { query, sql } from '@/lib/db';
import {
  Domain,
  ExpandedDomain,
  ExpandedMember,
  ExpandedPrivateChannel,
  ExpandedProfile,
  Member,
  PrivateChannel,
  Profile,
  RemoteAppState,
} from '@/lib/types';
import { GetServerSideProps } from 'next';
import { refresh } from '@/lib/utility/authenticate';
import { api } from '@/lib/api';

import appTheme from '@/lib/ui/themes/light';
import { merge, omit, pick } from 'lodash';

////////////////////////////////////////////////////////////
function ScreenState({ router }: { router: NextRouter }) {
  const rtc = useRtc();

  // Attach realtime event handlers
  useRealtimeHandlers();

  // Show join domain screen if specified
  if (router.query.join) {
    return (
      <JoinDomain
        domain_id={router.query.join as string}
        onSubmit={() => router.replace(config.domains.app_path)}
      />
    );
  }

  return (
    <>
      <Main visible />

      {rtc.joined && (
        <>
          <RtcVoices />
        </>
      )}
    </>
  );
}

////////////////////////////////////////////////////////////
function WithAppState() {
  const router = useRouter();

  // Theme override
  const themeOverride = useMemo(() => {
    // Get the colors
    const colors = {
      ...pick(appTheme, ['primary', 'secondary', 'accent']),
      dark: [
        '#E9ECF0',
        '#BFC0C6',
        '#96999F',
        '#626771',
        '#434852',
        '#32363E',
        '#272B34',
        '#1F242A',
        '#181D23',
        '#111519',
      ] as Tuple<string, 10>,
    };

    // Default values
    const primaryShade =
      appTheme.default_shade === undefined ? 5 : appTheme.default_shade;
    const defaultGradient =
      typeof appTheme.gradient === 'function'
        ? appTheme.gradient(DEFAULT_THEME)
        : appTheme.gradient;

    // Override object
    const override = {
      colorScheme: appTheme.scheme,
      colors,
      white: colors.primary[0],
      black: colors.primary[9],
      primaryColor: 'secondary',
      primaryShade,
      defaultGradient: { from: defaultGradient[0], to: defaultGradient[1] },

      components: {
        Avatar: {
          styles: (theme) => ({
            placeholder: {
              background: theme.other.elements.avatar,
              color: theme.other.elements.avatar_text,
            },
            placeholderIcon: {
              color: theme.other.elements.avatar_text,
            },
          }),
        },

        DatePickerInput: {
          styles: (theme) => ({
            day: {
              '&:hover': { background: theme.other.colors.page_hover },
              '&[data-today="true"]:not([data-selected="true"])': {
                background: theme.other.colors.panel_hover,
                '&:hover': { background: theme.other.colors.panel_hover },
              },
              '&[data-weekend="true"]': {
                color: theme.other.colors.page_dimmed,
                fontWeight: 600,
              },
              '&[data-weekend="true"][data-selected="true"]': {
                color: theme.white,
              },
            },
          }),
        },

        Input: {
          styles: (theme) => ({
            wrapper: {
              marginTop: 5,
            },
          }),
        },

        InputWrapper: {
          styles: (theme) => ({
            description: {
              marginTop: 1,
              marginBottom: 10,
            },
          }),
        },

        Menu: {
          styles: (theme) => ({
            dropdown: {
              borderColor: theme.other.colors.page_border,
            },
            divider: {
              borderColor: theme.other.colors.page_border,
            },
          }),
        },

        MultiSelect: {
          styles: (theme) => ({
            dropdown: {
              boxShadow: '0px 2px 10px #00000022',
            },
            item: {
              '&[data-hovered]': {
                background: `linear-gradient(to right, ${theme.other.colors.neutral_highlight} 4px, ${theme.other.colors.page_hover} 0)`,
              },
            },
          }),
        },

        Popover: {
          styles: (theme) => ({
            dropdown: {
              boxShadow: theme.shadows.sm,
            },
          }),
        },

        Select: {
          styles: (theme) => ({
            dropdown: {
              boxShadow: '0px 2px 10px #00000022',
            },
            item: {
              whiteSpace: 'normal',
              '&[data-hovered]': {
                background: `linear-gradient(to right, ${theme.other.colors.neutral_highlight} 4px, ${theme.other.colors.page_hover} 0)`,
              },
              '&[data-selected]': {
                background: `linear-gradient(to right, ${theme.other.colors.secondary_highlight} 4px, ${theme.other.colors.page_hover} 0)`,
                color: theme.other.colors.page_text,
              },
            },
          }),
        },

        Slider: {
          styles: (theme) => ({
            trackContainer: { cursor: 'default' },
          }),
        },

        Tooltip: {
          styles: (theme) => ({
            tooltip: {
              background: theme.other.elements.tooltip,
              color: theme.other.elements.tooltip_text,
            },
          }),
        },
      },
    } as MantineThemeOverride;

    // Add custom properties
    const others = omit(appTheme, ['primary', 'secondary', 'accent']);
    const merged = merge({}, DEFAULT_THEME, override, { other: others });

    // Defaults
    others.gradient = defaultGradient;

    others.colors.neutral_highlight =
      others.colors.neutral_highlight || ((theme) => theme.colors.gray[5]);
    others.colors.secondary_highlight =
      others.colors.secondary_highlight ||
      ((theme) => theme.colors.secondary[primaryShade]);
    others.colors.ping_highlight =
      others.colors.ping_highlight ||
      ((theme) =>
        theme.fn.linearGradient(0, defaultGradient[0], defaultGradient[1]));

    others.elements.emoji_picker =
      others.elements.emoji_picker || others.colors.page;
    others.elements.emoji_picker_hover =
      others.elements.emoji_picker_hover || others.colors.page_hover;
    others.elements.emoji_picker_border =
      others.elements.emoji_picker_border || others.colors.page_border;
    others.elements.emoji_picker_icon =
      others.elements.emoji_picker_icon || others.colors.page_dimmed;
    others.elements.emoji_picker_icon_active =
      others.elements.emoji_picker_icon_active || others.colors.page_text;
    others.elements.emoji_picker_highlight =
      others.elements.emoji_picker_highlight ||
      merged.fn.linearGradient(50, defaultGradient[1], defaultGradient[0]);

    others.elements.emote_button =
      others.elements.emote_button || others.colors.page;
    others.elements.emote_button_border =
      others.elements.emote_button_border || others.colors.page_border;
    others.elements.emote_button_text =
      others.elements.emote_button_text || others.colors.page_text;

    others.elements.message_highlight_ping =
      others.elements.message_highlight_ping ||
      ((theme) => `${theme.colors.accent[primaryShade]}20`);
    others.elements.message_highlight_ping_hover =
      others.elements.message_highlight_ping_hover ||
      ((theme) => `${theme.colors.accent[primaryShade]}30`);

    others.elements.rtc_join_panel_shadow =
      others.elements.rtc_join_panel_shadow || merged.shadows.md;

    others.elements.settings_tabs_highlight =
      others.elements.settings_tabs_highlight ||
      ((theme) =>
        theme.fn.linearGradient(0, defaultGradient[0], defaultGradient[1]));

    others.elements.tooltip = others.elements.tooltip || ((theme) => theme.colors.dark[9]);
    others.elements.tooltip_text = others.elements.tooltip_text || ((theme) => theme.colors.dark[0]);

    // For every function value, turn it into a string
    for (const [k, v] of Object.entries(others)) {
      // @ts-ignore
      if (typeof v === 'function') others[k] = v(merged);
    }
    for (const [k, v] of Object.entries(others.colors || {})) {
      // @ts-ignore
      if (typeof v === 'function') others.colors[k] = v(merged);
    }
    for (const [k, v] of Object.entries(others.elements || {})) {
      // @ts-ignore
      if (typeof v === 'function') others.elements[k] = v(merged);
    }

    // Defaults
    others.elements.calendar_text =
      others.elements.calendar_text || others.colors.page_text;
    others.elements.calendar_dimmed =
      others.elements.calendar_dimmed || others.colors.page_dimmed;
    others.elements.calendar_hover =
      others.elements.calendar_hover || others.colors.page_hover;
    others.elements.calendar_active =
      others.elements.calendar_active || others.colors.panel_hover;
    others.elements.calendar_border =
      others.elements.calendar_border || others.colors.panel_border;
    others.elements.calendar_today =
      others.elements.calendar_today || others.colors.panel;
    others.elements.calendar_today_text =
      others.elements.calendar_today_text || others.colors.panel_text;
    others.elements.calendar_today_dimmed =
      others.elements.calendar_today_dimmed || others.colors.panel_dimmed;
    others.elements.calendar_today_hover =
      others.elements.calendar_today_hover || others.colors.panel_hover;
    others.elements.calendar_time_indicator =
      others.elements.calendar_time_indicator ||
      merged.colors.accent[primaryShade];
    others.elements.calendar_block_event =
      others.elements.calendar_block_event || others.colors.page;
    others.elements.calendar_block_event_text =
      others.elements.calendar_block_event_text || others.colors.panel_text;
    others.elements.calendar_block_event_dimmed =
      others.elements.calendar_block_event_dimmed || others.colors.panel_dimmed;
    others.elements.calendar_block_event_shadow =
      others.elements.calendar_block_event_shadow || merged.shadows.sm;
    others.elements.calendar_month_header =
      others.elements.calendar_month_header || others.colors.panel;
    others.elements.calendar_month_header_text =
      others.elements.calendar_month_header_text || others.colors.panel_text;

    others.elements.context_menu_shadow =
      others.elements.context_menu_shadow || merged.shadows.sm;

    others.elements.create_domain =
      others.elements.create_domain || others.colors.panel;

    others.elements.kanban_column =
      others.elements.kanban_column || others.colors.document;
    others.elements.kanban_header =
      others.elements.kanban_header || others.colors.panel;
    others.elements.kanban_header_hover =
      others.elements.kanban_header_hover || others.colors.panel_hover;
    others.elements.kanban_header_text =
      others.elements.kanban_header_text || others.colors.panel_text;
    others.elements.kanban_header_icon =
      others.elements.kanban_header_icon || others.colors.panel_dimmed;
    others.elements.kanban_card =
      others.elements.kanban_card || others.colors.panel;
    others.elements.kanban_card_shadow =
      others.elements.kanban_card_shadow || merged.shadows.sm;
    others.elements.kanban_card_text =
      others.elements.kanban_card_text || others.colors.panel_text;
    others.elements.kanban_card_dimmed =
      others.elements.kanban_card_dimmed || others.colors.panel_dimmed;

    others.elements.rtc_join_panel =
      others.elements.rtc_join_panel || others.colors.panel;
    others.elements.rtc_join_panel_hover =
      others.elements.rtc_join_panel_hover || others.colors.panel_hover;
    others.elements.rtc_join_panel_text =
      others.elements.rtc_join_panel_text || others.colors.panel_text;
    others.elements.rtc_join_panel_dimmed =
      others.elements.rtc_join_panel_dimmed || others.colors.panel_dimmed;

    others.elements.rte = others.elements.rte || others.colors.page;
    others.elements.rte_header =
      others.elements.rte_header || others.colors.panel;
    others.elements.rte_panel =
      others.elements.rte_panel || others.colors.panel;
    others.elements.rte_border =
      others.elements.rte_border || merged.colors.primary[4];
    others.elements.rte_icon =
      others.elements.rte_icon || others.colors.panel_dimmed;
    others.elements.rte_hover =
      others.elements.rte_hover || others.colors.panel_hover;
    others.elements.rte_dimmed =
      others.elements.rte_dimmed || others.colors.page_dimmed;

    others.elements.settings = others.elements.settings || others.colors.page;
    others.elements.settings_border =
      others.elements.settings_border || others.colors.page_border;
    others.elements.settings_text =
      others.elements.settings_text || others.colors.page_text;
    others.elements.settings_dimmed =
      others.elements.settings_dimmed || others.colors.page_dimmed;
    others.elements.settings_hover =
      others.elements.settings_hover || others.colors.page_hover;
    others.elements.settings_panel =
      others.elements.settings_panel || others.colors.document;
    others.elements.settings_panel_hover =
      others.elements.settings_panel_hover || others.colors.document_hover;
    others.elements.settings_panel_text =
      others.elements.settings_panel_text || others.colors.document_text;
    others.elements.settings_panel_dimmed =
      others.elements.settings_panel_dimmed || others.colors.document_dimmed;
    others.elements.settings_tabs =
      others.elements.settings_tabs || others.colors.panel;
    others.elements.settings_tabs_text =
      others.elements.settings_tabs_text || others.colors.panel_text;
    others.elements.settings_tabs_dimmed =
      others.elements.settings_tabs_dimmed || others.colors.panel_dimmed;
    others.elements.settings_tabs_hover =
      others.elements.settings_tabs_hover || others.colors.panel_hover;

    others.elements.data_table =
      others.elements.data_table || others.colors.page;
    others.elements.data_table_border =
      others.elements.data_table_border || others.colors.panel_border;
    others.elements.data_table_text =
      others.elements.data_table_text || others.colors.page_text;
    others.elements.data_table_dimmed =
      others.elements.data_table_dimmed || others.colors.page_dimmed;
    others.elements.data_table_hover =
      others.elements.data_table_hover || others.colors.page_hover;
    others.elements.data_table_header =
      others.elements.data_table_header || others.colors.document;
    others.elements.data_table_header_text =
      others.elements.data_table_header_text || others.colors.panel_text;
    others.elements.data_table_header_dimmed =
      others.elements.data_table_header_dimmed || others.colors.document_dimmed;
    others.elements.data_table_header_hover =
      others.elements.data_table_header_hover || others.colors.document_hover;

    override.other = others;

    return override;
  }, []);

  return (
    <MantineProvider withGlobalStyles withNormalizeCSS theme={themeOverride}>
      <RtcProvider>
        <ConfirmModal>
          <ModalsProvider
            modals={modals}
            modalProps={{ scrollAreaComponent: ScrollArea.Autosize }}
          >
            <ScreenState router={router} />
          </ModalsProvider>
        </ConfirmModal>
      </RtcProvider>
    </MantineProvider>
  );
}

////////////////////////////////////////////////////////////
export default function App(props: AppProps) {
  const router = useRouter();

  const session = useSession();
  const profile = useCurrentProfile();

  // Initialization logic (auth, emotes)
  useEffect(() => {
    // Should be only client side
    if (typeof window === 'undefined') return;

    // Set initial profile
    if (props.profile) setProfileDefault(props.profile);

    // Set initial domain
    if (props.domain) setDomainDefault(props.domain);

    // Set initial members and domain
    if (props.app?.domain) {
      setMembers(props.app.domain, props.members || [], { emit: false });

      if (props.counts) {
        setMemberQuery(props.app.domain, { page: 0 }, props.counts.total);
        setMemberQuery(
          props.app.domain,
          { page: 0, online: true },
          props.counts.online,
        );
        setMemberQuery(
          props.app.domain,
          { page: 0, online: false },
          props.counts.offline,
        );
      }
    }

    // Check if token exists, if not try refreshing
    if (!props.token) {
      // Refresh session (refresh won't occur if session is already valid)
      session._mutators.refresh().then((success) => {
        // Redirect to log in if refresh failed
        if (!success)
          // Redirect while keeping all query parameters
          router.replace(
            `/login?redirect=${encodeURIComponent(router.asPath)}`,
          );
      });
    } else {
      session._mutators.applyToken(props.token);
      console.log('found token', props.app?.last_accessed)
    }
  }, []);

  // Realtime server
  useEffect(() => {
    if (!session.token || !session.profile_id) return;
    connect(session);
  }, [session.token, session.profile_id]);

  // Loading screen
  if (!session._exists || (session.profile_id && !profile._exists)) {
    return (
      <Center style={{ height: '80vh' }}>
        <Loader variant='bars' />
      </Center>
    );
  }

  // Show create profile panel if no current profile
  if (session._exists && !session.profile_id) {
    return (
      <Center style={{ height: '60vh' }}>
        <CreateProfile />
      </Center>
    );
  }

  return (
    <ErrorBoundary height='90vh'>
      <AppProvider initial={props.app}>
        <WithAppState />
      </AppProvider>
    </ErrorBoundary>
  );
}

////////////////////////////////////////////////////////////
const MEMBER_SELECT_FIELDS = [
  'in AS id',
  'is_admin',
  'is_owner',
  'alias',
  'roles',
  'time_joined',
  'in.profile_picture AS profile_picture',
  'in.banner AS banner',
  'in.online AS online',
];

////////////////////////////////////////////////////////////
function removeUndefined(obj: any): any {
  if (obj === null) return null;
  else if (typeof obj === 'object')
    if (Array.isArray(obj)) return obj;
    else {
      return Object.entries(obj)
        .filter(([k, v]: [string, any]) => v !== undefined)
        .reduce(
          (r, [key, value]) => ({ ...r, [key]: removeUndefined(value) }),
          {},
        );
    }
  else return obj;
}

////////////////////////////////////////////////////////////
function recordKeys(
  map: Record<string, any> | undefined,
  table: string,
  transform?: (v: any) => any,
) {
  if (!map) return undefined;

  const newMap: Record<string, any> = {};
  for (const [k, v] of Object.entries(map))
    newMap[`${table}:${k}`] = transform ? transform(v) : v;
  return newMap;
}

////////////////////////////////////////////////////////////
type AppProps = {
  profile?: ExpandedProfile;
  domain?: ExpandedDomain;
  members?: ExpandedMember[];
  counts?: { total: number; online: number; offline: number };
  app?: RemoteAppState;
  token?: string;
};

////////////////////////////////////////////////////////////
export const getServerSideProps: GetServerSideProps<AppProps> = async (ctx) => {
  // Get initial data
  /* sql.multi([
    sql.let('$app', sql.select<RemoteAppState>('*', { from: }))
  ]); */

  // Create new access token
  const refreshResult = await refresh(ctx.req, ctx.res, false);

  // If not valid refresh, return no props
  if (!refreshResult) return { props: {} };

  // Get payload
  const token = refreshResult[0];
  const payload = refreshResult[1];
  if (typeof token !== 'string' || typeof payload === 'string')
    return { props: {} };

  // Early return object
  const tokenRet: any = { props: { token } };

  // Quit early if user does not have an active profile
  const { profile_id } = payload;
  if (!profile_id) return tokenRet;

  // App state id
  const stateId = `app_states:${profile_id.split(':')[1]}`;

  // Get most data except domain (complex set of selects, so leave api to handle it)
  const _1 = await query<
    [
      unknown,
      ExpandedProfile[],
      ExpandedMember[],
      ExpandedMember[],
      ExpandedMember[],
      ExpandedMember[],
      ExpandedPrivateChannel[],
      RemoteAppState,
    ]
  >(
    sql.multi([
      // Get app state, used to find out which domain to fetch
      sql.let(
        '$app',
        sql.single(sql.select<RemoteAppState>('*', { from: stateId })),
      ),

      // Get profile
      sql.select<Profile>(
        [
          '*',
          sql.wrap(
            sql.select<Domain>(['id', 'name', 'icon', 'time_created'], {
              from: '->member_of->domains',
            }),
            { alias: 'domains' },
          ),
        ],
        { from: profile_id },
      ),

      // Get all members
      sql.if({
        cond: '$app.domain != NONE',
        body: sql.select<Member>(MEMBER_SELECT_FIELDS, {
          from: `$app.domain<-member_of`,
          limit: config.app.member.query_limit,
          sort: [
            { field: 'is_admin', order: 'DESC' },
            { field: 'alias', mode: 'COLLATE' },
          ],
        }),
      }),
      // Get online members
      sql.if({
        cond: '$app.domain != NONE',
        body: sql.select<Member>(MEMBER_SELECT_FIELDS, {
          from: `$app.domain<-member_of`,
          where: 'in.online==true',
          limit: config.app.member.query_limit,
          sort: [
            { field: 'is_admin', order: 'DESC' },
            { field: 'alias', mode: 'COLLATE' },
          ],
        }),
      }),
      // Get offline members
      sql.if({
        cond: '$app.domain != NONE',
        body: sql.select<Member>(MEMBER_SELECT_FIELDS, {
          from: `$app.domain<-member_of`,
          where: 'in.online!=true',
          limit: config.app.member.query_limit,
          sort: [
            { field: 'is_admin', order: 'DESC' },
            { field: 'alias', mode: 'COLLATE' },
          ],
        }),
      }),
      // Get own member object
      sql.if({
        cond: '$app.domain != NONE',
        body: sql.select<Member>(MEMBER_SELECT_FIELDS, {
          from: `$app.domain<-member_of`,
          where: sql.match({ in: profile_id }),
        }),
      }),

      // Get private channels (dms)
      sql.select<PrivateChannel>(['*', '<-private_member_of.in AS members'], {
        from: `${profile_id}->private_member_of->private_channels`,
        sort: [{ field: '_last_event', order: 'DESC' }],
      }),

      // Return app state
      sql.return('$app'),
    ]),
    { complete: true },
  );
  if (!_1) return tokenRet;

  const [_, profiles, members, online, offline, selfs, dms, app] = _1;

  // Get domain
  let domain: ExpandedDomain | null = null;
  if (app?.domain) {
    domain = await api(
      'GET /domains/:domain_id',
      {
        params: { domain_id: app.domain },
      },
      { session: { _exists: true, token } },
    );
  }

  // Members
  const memberMap: Record<string, ExpandedMember> = {};
  for (const member of members || []) memberMap[member.id] = member;
  for (const member of online || []) memberMap[member.id] = member;
  for (const member of offline || []) memberMap[member.id] = member;
  for (const member of selfs || [])
    memberMap[member.id] = { ...member, online: true };

  // Check if the count has to be adjusted
  const changeCount = selfs?.length ? selfs[0].online !== true : false;

  // Counts
  const counts = {
    total: Object.keys(members || []).length,
    online: Object.keys(online || []).length + (changeCount ? 1 : 0),
    offline: Object.keys(offline || []).length - (changeCount ? 1 : 0),
  };

  return {
    props: removeUndefined({
      profile:
        profiles.length > 0
          ? {
              ...profiles[0],
              // TODO : Make domains draggable
              domains: profiles[0].domains.sort(
                (a: Domain, b: Domain) =>
                  new Date(a.time_created).getTime() -
                  new Date(b.time_created).getTime(),
              ),
            }
          : undefined,
      domain: domain || undefined,
      members: Object.values(memberMap),
      counts,
      dms,
      app: app
        ? {
            ...app,
            channels: recordKeys(app.channels, 'domains'),
            last_accessed: recordKeys(app.last_accessed, 'domains', (v) =>
              recordKeys(v, 'channels'),
            ),
            private_last_accessed: recordKeys(app.private_last_accessed, 'private_channels'),
            pings: recordKeys(app.pings, 'channels'),
            private_pings: recordKeys(app.private_pings, 'private_channels'),
            private_channel_states: recordKeys(app.private_channel_states, 'private_channels'),
            chat_states: recordKeys(app.chat_states, 'channels'),
            board_states: recordKeys(app.board_states, 'boards'),
          }
        : undefined,
      token,
    }),
  };
};
