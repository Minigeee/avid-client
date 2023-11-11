import { } from 'react';

import {
  ActionIcon,
  Box,
  useMantineTheme,
} from '@mantine/core';

import Calendar from '@/lib/ui/components/Calendar/Calendar';

import { Channel } from '@/lib/types';
import { DomainWrapper } from '@/lib/hooks';


////////////////////////////////////////////////////////////
export type CalendarViewProps = {
  channel: Channel;
  domain: DomainWrapper;
};

////////////////////////////////////////////////////////////
export default function CalendarView(props: CalendarViewProps) {
  const theme = useMantineTheme();

  return (
    <Box h='100%' p='1.25rem'>
      <Calendar
        domain={props.domain}
        events={[
          {
            id: 'a',
            title: 'Test Event',
            start: new Date(2023, 7, 28, 18).toISOString(),
            end: new Date(2023, 7, 28, 20).toISOString(),
            time_created: new Date().toISOString(),
          },
          {
            id: 'b',
            title: 'Test Event 2',
            start: new Date(2023, 7, 28, 19).toISOString(),
            end: new Date(2023, 7, 28, 21).toISOString(),
            time_created: new Date().toISOString(),
          },
          {
            id: 'c',
            title: 'Test Event 3',
            start: new Date(2023, 7, 28, 20, 15).toISOString(),
            end: new Date(2023, 7, 28, 22).toISOString(),
            time_created: new Date().toISOString(),
          },
          {
            id: 'd',
            title: 'Test Event 4',
            start: new Date(2023, 7, 23).toISOString(),
            end: new Date(2023, 7, 24, 1).toISOString(),
            time_created: new Date().toISOString(),
          },
          {
            id: 'e',
            title: 'Test Event 5',
            start: new Date(2023, 7, 25).toISOString(),
            end: new Date(2023, 7, 27, 1).toISOString(),
            time_created: new Date().toISOString(),
          },
          {
            id: 'f',
            title: 'Test Event 6',
            start: new Date(2023, 7, 24).toISOString(),
            end: new Date(2023, 7, 25, 1).toISOString(),
            time_created: new Date().toISOString(),
          },
        ]}
      />
    </Box>
  );
}
