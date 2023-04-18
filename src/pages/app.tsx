import { useRouter } from 'next/router';
import { useEffect } from 'react';

import { useSession } from '@/lib';


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

  }, [session.profile_id]);


  // WIP : Work on profile creation

  return (
    <div>{session.token}</div>
  );
}
