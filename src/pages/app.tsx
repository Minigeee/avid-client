import { NextRouter, useRouter } from 'next/router';
import { useEffect } from 'react';

import {
  Center,
  Loader,
} from '@mantine/core';

import ErrorBoundary from '@/lib/ui/components/ErrorBoundary';
import RtcVoices from '@/lib/ui/components/rtc/RtcVoices';
import CreateProfile from '@/lib/ui/screens/CreateProfile';
import Main from '@/lib/ui/screens/Main';
import JoinDomain from '@/lib/ui/screens/JoinDomain';

import config from '@/config';
import AppProvider from '@/lib/contexts/app';
import { useApp, useProfile, useSession } from '@/lib/hooks';


////////////////////////////////////////////////////////////
function ScreenState({ router }: { router: NextRouter }) {
  const app = useApp();

  // Show join domain screen if specified
  if (router.query.join) {
    return (
      <JoinDomain
        domain_id={router.query.join as string}
        inviter_id={router.query.inviter as string | undefined}
        onSubmit={() => router.replace(config.domains.app_path)}
      />
    );
  }

  return (
    <>
      <Main visible={app.navigation.screen === 'main'} />

      {app.rtc?.joined && (
        <>
          <RtcVoices />
        </>
      )}
    </>
  );
}


////////////////////////////////////////////////////////////
export default function App() {
  const router = useRouter();

  const session = useSession();
  const profile = useProfile(session.profile_id);

  
  // Authentication logic
  useEffect(() => {
    // Should be only client side
    if (typeof window === 'undefined') return;

    // Refresh session (refresh won't occur if session is already valid)
    session._mutators.refresh().then((success) => {
      // Redirect to log in if refresh failed
      if (!success)
        // Redirect while keeping all query parameters
        router.replace(`/login?redirect=${encodeURIComponent(router.asPath)}`);
    });
  }, []);


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
    <ErrorBoundary>
      <AppProvider>
        <ScreenState router={router} />
      </AppProvider>
    </ErrorBoundary>
  );
}
