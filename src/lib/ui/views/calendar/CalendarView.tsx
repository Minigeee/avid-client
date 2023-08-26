import { } from 'react';

import {
  ActionIcon,
  Box,
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
  return (
    <Box h='100%' p='1.25rem'>
      <Calendar events={[
        {
          id: '',
          title: 'Test Event',
          start: new Date(2023, 7, 24, 18).toISOString(),
          end: new Date(2023, 7, 24, 20).toISOString(),
          time_created: new Date().toISOString(),
        },
        {
          id: '',
          title: 'Test Event 2',
          start: new Date(2023, 7, 24, 19).toISOString(),
          end: new Date(2023, 7, 24, 21).toISOString(),
          time_created: new Date().toISOString(),
        },
        {
          id: '',
          title: 'Test Event 3',
          start: new Date(2023, 7, 24, 20, 0).toISOString(),
          end: new Date(2023, 7, 24, 22).toISOString(),
          time_created: new Date().toISOString(),
        },
        {
          id: '',
          title: 'Test Event 4',
          start: new Date(2023, 7, 23).toISOString(),
          end: new Date(2023, 7, 24, 1).toISOString(),
          time_created: new Date().toISOString(),
        },
        {
          id: '',
          title: 'Test Event 5',
          start: new Date(2023, 7, 18).toISOString(),
          end: new Date(2023, 7, 20, 1).toISOString(),
          time_created: new Date().toISOString(),
        },
        {
          id: '',
          title: 'Test Event 6',
          start: new Date(2023, 7, 24).toISOString(),
          end: new Date(2023, 7, 25, 1).toISOString(),
          time_created: new Date().toISOString(),
        },
      ]} />
    </Box>
  );
}
