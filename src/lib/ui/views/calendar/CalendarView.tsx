import { useCallback, useEffect, useMemo, useState } from 'react';

import { ActionIcon, Box, useMantineTheme } from '@mantine/core';

import Calendar, {
  OnEditEvent,
  OnNewEvent,
  OnDeleteEvent,
} from '@/lib/ui/components/Calendar/Calendar';

import { Channel } from '@/lib/types';
import {
  DomainWrapper,
  hasPermission,
  useApp,
  useCalendarEvents,
} from '@/lib/hooks';
import { socket } from '@/lib/utility/realtime';

import moment, { Moment } from 'moment';

////////////////////////////////////////////////////////////
export type CalendarViewProps = {
  channel: Channel;
  domain: DomainWrapper;
};

////////////////////////////////////////////////////////////
export default function CalendarView(props: CalendarViewProps) {
  const app = useApp();

  // Calendar events
  const [currDate, setCurrDate] = useState<Moment>(moment());
  const events = useCalendarEvents(props.channel.id, currDate);

  // Indicates if new activity detected
  const [refreshEnabled, setRefreshEnabled] = useState<boolean>(false);

  // Refresh on stale data
  useEffect(() => {
    if (!app.stale[props.channel.id]) return;

    // Refresh data
    if (events._exists) events._refresh();

    // Reset stale flag
    app._mutators.setStale(props.channel.id, false);
  }, []);

  // Enable refresh on board activity
  useEffect(() => {
    function onActivity(channel_id: string) {
      if (channel_id !== props.channel.id) return;
      setRefreshEnabled(true);
    }

    socket().on('calendar:activity', onActivity);

    return () => {
      socket().off('calendar:activity', onActivity);
    };
  }, [props.channel.id]);

  // Determines if user can manage calendar events
  const canManageEvents = useMemo(
    () => hasPermission(props.domain, props.channel.id, 'can_manage_events'),
    [props.domain, props.channel.id],
  );

  // Called on event create
  const onNewEvent = useCallback<OnNewEvent>(
    async (event) => {
      if (!events._exists) return;

      // New event
      await events._mutators.addEvent({ ...event, channel: props.channel.id });
    },
    [events, props.channel.id],
  );

  // Called on event edit
  const onEditEvent = useCallback<OnEditEvent>(
    (event_id, event) => {
      if (!events._exists) return;

      // If time changed for a repeated event, only change the hours & mins
      const orig = events.data.find((e) => e.id === event_id);
      if (orig && orig.repeat && (!orig.all_day || event.all_day === false)) {
        if (event.start) {
          const estart = moment(event.start);
          event.start = moment(orig.start)
            .startOf('day')
            .add({ h: estart.hours(), m: estart.minutes() })
            .toISOString();
        }

        if (event.end) {
          const eend = moment(event.end);
          event.end = moment(orig.end)
            .startOf('day')
            .add({ h: eend.hours(), m: eend.minutes() })
            .toISOString();
        }
      }

      // Update event
      events._mutators.updateEvent(event_id, event, true);
    },
    [events],
  );

  // Called on event delete
  const onDeleteEvent = useCallback<OnDeleteEvent>(
    (event_id) => {
      if (!events._exists) return;

      // Delete event
      events._mutators.removeEvent(event_id);
    },
    [events],
  );

  // Called on calendar refresh button
  const onRefresh = useCallback(() => {
    if (!events._exists) return;

    // Refresh
    events._refresh();
    // Hide refresh button
    setRefreshEnabled(false);
  }, [events]);

  return (
    <Box h='100%' p='1.25rem'>
      <Calendar
        domain={props.domain}
        events={events.data || []}
        editable={canManageEvents}
        withRefresh={refreshEnabled}
        onNewEvent={onNewEvent}
        onEditEvent={onEditEvent}
        onDeleteEvent={onDeleteEvent}
        onDateChange={setCurrDate}
        onRefresh={onRefresh}
      />
    </Box>
  );
}
