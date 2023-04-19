import { useRouter } from 'next/router';
import { useEffect } from 'react';

import {
  Box,
  Center,
} from '@mantine/core';

import CreateProfile from '@/lib/components/screens/CreateProfile';

import { useSession } from '@/lib';


////////////////////////////////////////////////////////////
export default function App() {
  const router = useRouter();

  const session = useSession();

  
  // Authentication logic
  useEffect(() => {
    // Should be only client side
    if (typeof window === 'undefined') return;

    // Check if session needs to be refreshed
    if (!session.hasAccessToken())
      // After refreshing, should have a valid access token
      session.refresh().then((success) => {
        // Redirect to log in if refresh failed
        if (!success)
          router.replace('/login');
      });

  }, []);


  // Show create profile panel if no current profile
  if (!session.profile_id) {
    return (
      <Center style={{ height: '60vh' }}>
        <CreateProfile />
      </Center>
    );
  }

  return (
    <div>{session.profile_id}</div>
  );
}
