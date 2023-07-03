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
import { useApp, useProfile, useSession } from '@/lib/hooks';
import { connect, useRealtimeHandlers } from '@/lib/utility/realtime';


////////////////////////////////////////////////////////////
function ScreenState({ router }: { router: NextRouter }) {
  const app = useApp();

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

  
  // Initialization logic (auth, emotes)
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
      <AppProvider>
        <ConfirmModal>
          <ModalsProvider modals={modals} modalProps={{ scrollAreaComponent: ScrollArea.Autosize }}>
            <ScreenState router={router} />
          </ModalsProvider>
        </ConfirmModal>
      </AppProvider>
    </ErrorBoundary>
  );
}
