import { RawMessage } from './api';
import { RemoteAppState } from './app_state';
import { TaskCollection } from './board';
import { Member } from './member';
import { Message } from './message';
import { DeepPartial } from './util';

type MediaType = 'audio' | 'video' | 'share';

/** All events signatures that are sent from server to client */
export interface ServerToClientEvents {
  error: (message: string, status?: number) => void;

  'general:joined': () => void;
  'general:user-joined': (profile_id: string) => void;
  'general:user-left': (profile_id: string) => void;
  'general:activity': (
    domain_id: string,
    channel_id: string,
    is_event: boolean,
  ) => void;
  'general:ping': (domain_id: string | undefined, channel_id: string) => void;
  /** Domain structure/settings have changed */
  'general:domain-update': (domain_id: string, forceUpdate: boolean) => void;

  'chat:message': (message: RawMessage) => void;
  'chat:edit-message': (
    channel_id: string,
    message_id: string,
    message: Partial<Message>,
  ) => void;
  'chat:delete-message': (channel_id: string, message_id: string) => void;
  'chat:typing': (
    profile_id: string,
    channel_id: string,
    type: 'start' | 'stop',
  ) => void;
  'chat:reactions': (
    channel_id: string,
    message_id: string,
    changes: Record<string, number>,
    removeAll: boolean,
  ) => void;

  'board:activity': (channel_id: string) => void;
  'board:add-collection': (
    board_id: string,
    collection: TaskCollection,
  ) => void;
  'board:delete-collection': (board_id: string, collection_id: string) => void;

  'rtc:user-joined': (
    domain_id: string,
    channel_id: string,
    profile_id: string,
  ) => void;
  'rtc:user-left': (
    domain_id: string,
    channel_id: string,
    profile_id: string,
  ) => void;

  'calendar:activity': (channel_id: string) => void;
}

/** All events signatures that are sent from client to server */
export interface ClientToServerEvents {
  'general:switch-room': (domain_id: string, channel_id: string) => void;
  'general:update-app-state': (state: DeepPartial<RemoteAppState>) => void;

  'chat:typing': (
    profile_id: string,
    channel_id: string,
    type: 'start' | 'stop',
  ) => void;

  'rtc:joined': (channel_id: string) => void;
  'rtc:left': (channel_id: string) => void;
}

/** All events signatures that are sent from server to client for the media server */
export interface Media_ServerToClientEvents {
  error: (message: string, status?: number) => void;

  config: (capabilities: any, producerConfig: any, consumerConfig: any) => void;
  joined: (
    participants: {
      id: string;
      is_admin: boolean;
      is_manager: boolean;
      is_deafened: boolean;
    }[],
    callback: () => void,
  ) => void;
  'make-consumer': (options: any, callback: (success: boolean) => void) => void;
  'participant-joined': (
    participant_id: string,
    is_admin: boolean,
    is_manager: boolean,
    is_deafened: boolean,
  ) => void;
  'participant-left': (participant_id: string) => void;
  'participant-talk': (
    participant_id: string,
    status: 'start' | 'stop',
  ) => void;
  'participant-deafened': (participant_id: string) => void;
  'participant-undeafened': (participant_id: string) => void;

  'consumer-closed': (consumer_id: string) => void;
  'consumer-paused': (consumer_id: string) => void;
  'consumer-resumed': (consumer_id: string) => void;
  'consumer-score': (consumer_id: string, score: any) => void;
  'consumer-layers-changed': (
    consumer_id: string,
    spatial: number | null,
    temporal: number | null,
  ) => void;

  'producer-score': (producer_id: string, score: any) => void;
  'producer-locked': (participant_id: string, type: MediaType) => void;
  'producer-unlocked': (participant_id: string, type: MediaType) => void;

  kicked: () => void;
}

/** All events signatures that are sent from client to server for the media server */
export interface Media_ClientToServerEvents {
  config: (
    device: any,
    rtpCapabilities: any,
    sctpCapabilities: any,
    deafened: boolean,
  ) => void;
  'connect-transport': (transport_id: string, dtlsParameters: any) => void;
  produce: (
    transport_id: string,
    params: { kind: any; rtpParameters: any; appData: any },
    callback: (producer_id: string | null) => void,
  ) => void;
  'consumers-paused': (consumer_ids: string[]) => void;
  'consumers-resumed': (consumer_ids: string[]) => void;
  'producer-closed': (producer_id: string) => void;
  'producer-paused': (producer_id: string) => void;
  'producer-resumed': (producer_id: string) => void;

  kick: (participant_id: string) => void;
  deafen: () => void;
  undeafen: () => void;
  'lock-producer': (participant_id: string, type: MediaType) => void;
  'unlock-producer': (participant_id: string, type: MediaType) => void;
}
