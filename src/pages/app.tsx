import { NextRouter, useRouter } from 'next/router';
import { useEffect } from 'react';

import {
  Center,
  Loader,
  ScrollArea,
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
import { setDomainDefault, setMemberQuery, setMembers, setProfileDefault, useProfile, useRtc, useSession } from '@/lib/hooks';
import { connect, useRealtimeHandlers } from '@/lib/utility/realtime';
import { query, sql } from '@/lib/db';
import { Domain, ExpandedDomain, ExpandedMember, ExpandedProfile, Member, Profile, RemoteAppState } from '@/lib/types';
import { GetServerSideProps } from 'next';
import { refresh } from '@/lib/utility/authenticate';
import { api } from '@/lib/api';


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
export default function App(props: AppProps) {
  const router = useRouter();

  const session = useSession();
  const profile = useProfile(session.profile_id);
  
  // Initialization logic (auth, emotes)
  useEffect(() => {
    // Should be only client side
    if (typeof window === 'undefined') return;

    // Set initial profile
    if (props.profile)
      setProfileDefault(props.profile);

    // Set initial domain
    if (props.domain)
      setDomainDefault(props.domain);

    // Set initial members and domain
    if (props.app?.domain) {
      setMembers(props.app.domain, props.members || [], { emit: false });

      if (props.counts) {
        setMemberQuery(props.app.domain, { page: 0 }, props.counts.total);
        setMemberQuery(props.app.domain, { page: 0, online: true }, props.counts.online);
        setMemberQuery(props.app.domain, { page: 0, online: false }, props.counts.offline);
      }
    }

    // Check if token exists, if not try refreshing
    if (!props.token) {
      // Refresh session (refresh won't occur if session is already valid)
      session._mutators.refresh().then((success) => {
        // Redirect to log in if refresh failed
        if (!success)
          // Redirect while keeping all query parameters
          router.replace(`/login?redirect=${encodeURIComponent(router.asPath)}`);
      });
    }

    else
      session._mutators.applyToken(props.token);
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
        <RtcProvider>
          <ConfirmModal>
            <ModalsProvider modals={modals} modalProps={{ scrollAreaComponent: ScrollArea.Autosize }}>
              <ScreenState router={router} />
            </ModalsProvider>
          </ConfirmModal>
        </RtcProvider>
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
	'in.online AS online',
];

////////////////////////////////////////////////////////////
function removeUndefined(obj: any): any {
  if (obj === null)
    return null;
  else if (typeof obj === 'object')
    if (Array.isArray(obj))
      return obj;
    
    else {
        return Object.entries(obj)
          .filter(([k, v]: [string, any]) => v !== undefined)
          .reduce((r, [key, value]) => ({ ...r, [key]: removeUndefined(value) }), {});
      }
  else
      return obj
    }

////////////////////////////////////////////////////////////
function recordKeys(map: Record<string, any> | undefined, table: string, transform?: (v: any) => any) {
	if (!map) return undefined;

	const newMap: Record<string, any> = {};
	for (const [k, v] of Object.entries(map))
		newMap[`${table}:${k}`] = transform ? transform(v) : v;
	return newMap;
}

////////////////////////////////////////////////////////////
type AppProps = {
  profile?: ExpandedProfile,
  domain?: ExpandedDomain,
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
  if (typeof token !== 'string' || typeof payload === 'string') return { props: {} };

  // Early return object
  const tokenRet: any = { props: { token } };

  // Quit early if user does not have an active profile
  const { profile_id } = payload;
  if (!profile_id) return tokenRet;


  // App state id
  const stateId = `app_states:${profile_id.split(':')[1]}`;

  // Get most data except domain (complex set of selects, so leave api to handle it)
  const _1 = await query<[unknown, ExpandedProfile[], ExpandedMember[], ExpandedMember[], ExpandedMember[], ExpandedMember[], RemoteAppState]>(sql.multi([
    // Get app state, used to find out which domain to fetch
    sql.let('$app', sql.select<RemoteAppState>('*', { from: stateId })),

    // Get profile
    sql.select<Profile>([
      '*',
      sql.wrap(sql.select<Domain>(
        ['id', 'name', 'icon', 'time_created'],
        { from: '->member_of->domains' }
      ), { alias: 'domains' }),
    ], { from: profile_id }),

    // Get all members
    sql.if({
      cond: '$app.domain != NONE',
      body: sql.select<Member>(MEMBER_SELECT_FIELDS, {
        from: `$app.domain<-member_of`,
        limit: config.app.member.query_limit,
        sort: [{ field: 'is_admin', order: 'DESC' }, { field: 'alias', mode: 'COLLATE' }],
      }),
    }),
    // Get online members
    sql.if({
      cond: '$app.domain != NONE',
      body: sql.select<Member>(MEMBER_SELECT_FIELDS, {
        from: `$app.domain<-member_of`,
        where: 'in.online==true',
        limit: config.app.member.query_limit,
        sort: [{ field: 'is_admin', order: 'DESC' }, { field: 'alias', mode: 'COLLATE' }],
      }),
    }),
    // Get offline members
    sql.if({
      cond: '$app.domain != NONE',
      body: sql.select<Member>(MEMBER_SELECT_FIELDS, {
        from: `$app.domain<-member_of`,
        where: 'in.online!=true',
        limit: config.app.member.query_limit,
        sort: [{ field: 'is_admin', order: 'DESC' }, { field: 'alias', mode: 'COLLATE' }],
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

    // Return app state
    sql.return('$app'),

  ]), { complete: true });
  if (!_1) return tokenRet;

  const [_, profiles, members, online, offline, selfs, app] = _1;

  // Get domain
  let domain: ExpandedDomain | null = null;
  if (app.domain) {
    domain = await api('GET /domains/:domain_id', {
      params: { domain_id: app.domain }
    }, { session: { _exists: true, token } });
  }

  // Members
  const memberMap: Record<string, ExpandedMember> = {};
  for (const member of members || [])
    memberMap[member.id] = member;
  for (const member of online || [])
    memberMap[member.id] = member;
  for (const member of offline || [])
    memberMap[member.id] = member;
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
      profile: profiles.length > 0 ? {
				...profiles[0],
				// TODO : Make domains draggable
				domains: profiles[0].domains.sort((a: Domain, b: Domain) => new Date(a.time_created).getTime() - new Date(b.time_created).getTime()),
			} : undefined,
      domain: domain || undefined,
      members: Object.values(memberMap),
      counts,
      app: app ? {
				...app,
				channels: recordKeys(app.channels, 'domains'),
				expansions: recordKeys(app.expansions, 'domains'),
				last_accessed: recordKeys(app.last_accessed, 'domains', (v) => recordKeys(v, 'channels')),
				pings: recordKeys(app.pings, 'channels'),
			} : undefined,
      token,
    }),
  };
}