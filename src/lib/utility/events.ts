import { uid } from "uid";

/** Map of event listeners */
const _listeners: Record<string, Record<string, any>> = {};

/** Event signatures */
type EventSignature<Ev extends string> = Ev extends 'channel-change'
  ? [channel_id: string | undefined, domain_id: string | undefined]
  : never;

/** Event system */
export const events = {
  /**
   * Emit event
   * 
   * @param event The event to emit
   */
  emit: <Ev extends string>(event: Ev, ...args: EventSignature<Ev>) => {
    // Get listeners
    const listeners = _listeners[event];
    if (!listeners) return;

    // Send event to all listeneres
    for (const fn of Object.values(listeners))
      fn(...args);
  },
  
  /**
   * Add an event listener
   * 
   * @param event The event to add the listener to
   * @param listener The listener func
   * @returns The id of the listener, needed to remove the listener
   */
  on: <Ev extends string>(event: Ev, listener: (...args: EventSignature<Ev>) => void) => {
    // Create listener map
    if (!_listeners[event]) _listeners[event] = {};

    const id = uid();
    _listeners[event][id] = listener;

    return `${event}:${id}`;
  },
  
  /**
   * Remove an event listener
   * 
   * @param id The id of the listener to remove
   */
  off: (id: string) => {
    const [event, key] = id.split(':');
    delete _listeners[event][key];
  },
};
