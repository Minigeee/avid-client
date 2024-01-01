import { CalendarEvent } from '@/lib/types';
import { CalendarEventsWrapper, DomainWrapper } from '@/lib/hooks';

import { Moment } from 'moment';
import { MutableRefObject } from 'react';

export type CalendarStyle = {
  /** Calendar colors */
  colors: {
    /** Default event color */
    event: string;
    /** Color of time indicator line in week and day view */
    timeIndicator: string;
    /** The color of cell borders */
    cellBorder: string;
  };

  /** The size of the time label gutter (px) */
  timeGutter: number;
  /** The time slot height for week and day views */
  slotHeight: string;
  /** The size of the month header (px) */
  monthHeaderHeight: number;

  /** Size of event resize border (px) */
  resizeMarginSize: number;
};

export type MomentCalendarEvent = Omit<CalendarEvent, 'start' | 'end'> & {
  start: Moment;
  end?: Moment;
};

/** Callback for create new event callback function */
export type OnNewEvent = (
  event: Omit<CalendarEvent, 'id' | 'time_created' | 'channel'>,
) => void | Promise<void>;
/** Callback for edit event callback function */
export type OnEditEvent = (
  event_id: string,
  event: Partial<Omit<CalendarEvent, 'id' | 'time_created' | 'channel'>>,
  override?: string,
) => void | Promise<void>;
/** Callback for delete event callback function */
export type OnDeleteEvent = (
  event_id: string,
  override?: string,
) => void | Promise<void>;

/** Callback for edit event callback function */
export type OnEditEventInternal = (
  newEvent: Partial<MomentCalendarEvent>,
  origEvent: MomentCalendarEvent,
) => void | Promise<void>;
/** Callback for delete event callback function */
export type OnDeleteEventInternal = (
  event: CalendarEvent | MomentCalendarEvent,
) => void | Promise<void>;

/** Holds calendar state */
export type CalendarState = {
  /** The domain that the calendar belongs to */
  domain?: DomainWrapper;
  /** Determines if user can manage calendar events */
  editable: boolean;

  /** The id of the event that has opened popup */
  popupId: string | null;
  /** Set the id of the event that has opened popup */
  setPopupId: (id: string | null) => void;

  /** Ref to new event callback */
  onNewEvent: MutableRefObject<OnNewEvent | undefined>;
  /** Ref to edit event callback */
  onEditEvent: MutableRefObject<OnEditEventInternal | undefined>;
  /** Ref to edit event callback */
  onDeleteEvent: MutableRefObject<OnDeleteEventInternal | undefined>;
};
