
import {
  Box,
  Flex,
} from '@mantine/core';

import DomainBar from '@/lib/ui/components/DomainBar';
import DomainView from '@/lib/ui/views/DomainView';

import { useApp } from '@/lib/hooks';


////////////////////////////////////////////////////////////
export default function Main() {
  const app = useApp();

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
