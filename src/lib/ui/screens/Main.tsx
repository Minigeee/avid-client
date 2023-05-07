import { useEffect } from 'react';

import {
  Box,
  Flex,
} from '@mantine/core';

import DomainBar from '@/lib/ui/components/DomainBar';
import DomainView from '@/lib/ui/views/DomainView';

import { useApp, useProfile, useSession } from '@/lib/hooks';


////////////////////////////////////////////////////////////
export default function Main() {
  const app = useApp();
  const session = useSession();
  
  const profile = useProfile(session.profile_id);

  // Set initial domain if remote nav state does not exist
  useEffect(() => {
    if (app.navigation._loading || app.navigation._exists) return;
    if (profile.domains?.length)
      app._mutators.navigation.setDomain(profile.domains[0].id);
  }, [app.navigation._loading]);


  return (
    <Flex w='100vw' h='100vh' gap={0} sx={(theme) => ({
      backgroundColor: theme.colors.dark[8],
    })}>
      <DomainBar />
      <Box sx={{
        flexGrow: 1,
        height: '100%',
      }}>
        {/* Actual domains */}
        {app.navigation.domain?.startsWith('domains') && (<DomainView domain_id={app.navigation.domain} />)}
      </Box>
    </Flex>
  );
}
