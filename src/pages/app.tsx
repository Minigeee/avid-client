import { useRouter } from 'next/router';
import { useEffect } from 'react';

import {
  Center,
  Loader,
} from '@mantine/core';

import ErrorBoundary from '@/lib/ui/components/ErrorBoundary';
import CreateProfile from '@/lib/ui/screens/CreateProfile';

import AppProvider from '@/lib/contexts/app';
import { useProfile, useSession } from '@/lib/hooks';
import Main from '@/lib/ui/screens/Main';


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
        router.replace('/login');
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
        <Main />
      </AppProvider>
    </ErrorBoundary>
  );
}
