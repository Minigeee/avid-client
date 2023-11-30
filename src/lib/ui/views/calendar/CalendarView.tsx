import { useCallback, useState } from 'react';

import {
  ActionIcon,
  Box,
  useMantineTheme,
} from '@mantine/core';

import Calendar, { OnEditEvent, OnNewEvent } from '@/lib/ui/components/Calendar/Calendar';

import { Channel } from '@/lib/types';
import { DomainWrapper, useCalendarEvents } from '@/lib/hooks';
import moment, { Moment } from 'moment';
import { OnDeleteEvent } from '../../components/Calendar/types';


////////////////////////////////////////////////////////////
export type CalendarViewProps = {
  channel: Channel;
  domain: DomainWrapper;
};

////////////////////////////////////////////////////////////
export default function CalendarView(props: CalendarViewProps) {
  // Calendar events
  const [currDate, setCurrDate] = useState<Moment>(moment());
  const events = useCalendarEvents(props.channel.id, currDate);


  // Called on event create
  const onNewEvent = useCallback<OnNewEvent>(async (event) => {
    if (!events._exists) return;

    // New event
    await events._mutators.addEvent({ ...event, channel: props.channel.id });
  }, [events, props.channel.id]);

  // Called on event edit
  const onEditEvent = useCallback<OnEditEvent>(async (event_id, event) => {
    if (!events._exists) return;

    // Update event
    events._mutators.updateEvent(event_id, event, true);
  }, [events]);

  // Called on event delete
  const onDeleteEvent = useCallback<OnDeleteEvent>(async (event_id,) => {
    if (!events._exists) return;

    // Delete event
    events._mutators.removeEvent(event_id);
  }, [events]);

  return (
    <Box h='100%' p='1.25rem'>
      <Calendar
        domain={props.domain}
        events={events.data || []}

        onNewEvent={onNewEvent}
        onEditEvent={onEditEvent}
        onDeleteEvent={onDeleteEvent}
        onDateChange={setCurrDate}
      />
    </Box>
  );
}
