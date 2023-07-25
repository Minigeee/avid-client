import { Member } from './member';
import { Message } from './message';


/** All events signatures that are sent from server to client */
export interface ServerToClientEvents {
	'error': (message: string, status?: number) => void,

	// WIP : Continue broadcast system
	'general:user-joined': (profile_id: string) => void,
	'general:user-left': (profile_id: string) => void,
	'general:activity': (domain_id: string, channel_id: string) => void,

	'chat:message': (domain_id: string, message: Message) => void;
	'chat:edit-message': (domain_id: string, channel_id: string, message_id: string, message: string) => void;
	'chat:delete-message': (domain_id: string, channel_id: string, message_id: string) => void;
	'chat:typing': (profile_id: string, channel_id: string, type: 'start' | 'stop') => void;
	'chat:reactions': (channel_id: string, message_id: string, changes: Record<string, number>, removeAll: boolean) => void;
}


/** All events signatures that are sent from client to server */
export interface ClientToServerEvents {
	'general:switch-room': (domain_id: string, channel_id: string) => void;

	'chat:message': (message: Message) => void;
	'chat:typing': (profile_id: string, channel_id: string, type: 'start' | 'stop') => void;
}


/** All events signatures that are sent from server to client for the media server */
export interface Media_ServerToClientEvents {
	'error': (message: string, status?: number) => void,

	'config': (capabilities: any, producerConfig: any, consumerConfig: any) => void;
	'joined': (participant_ids: string[], callback: () => void) => void;
	'make-consumer': (options: any, callback: (success: boolean) => void) => void;
	'participant-joined': (participant_id: string) => void;
	'participant-left': (participant_id: string) => void;
	'participant-talk': (participant_id: string, status: 'start' | 'stop') => void;
	'consumer-closed': (consumer_id: string) => void;
	'consumer-paused': (consumer_id: string) => void;
	'consumer-resumed': (consumer_id: string) => void;
	'consumer-score': (consumer_id: string, score: any) => void;
	'consumer-layers-changed': (consumer_id: string, spatial: number | null, temporal: number | null) => void;
	'producer-score': (producer_id: string, score: any) => void;
}


/** All events signatures that are sent from client to server for the media server */
export interface Media_ClientToServerEvents {
	'config': (device: any, rtpCapabilities: any, sctpCapabilities: any) => void;
	'connect-transport': (transport_id: string, dtlsParameters: any) => void;
	'produce': (transport_id: string, params: { kind: any; rtpParameters: any; appData: any; }, callback: (producer_id: string | null) => void) => void;
	'consumers-paused': (consumer_ids: string[]) => void;
	'consumers-resumed': (consumer_ids: string[]) => void;
	'producer-closed': (producer_id: string) => void;
	'producer-paused': (producer_id: string) => void;
	'producer-resumed': (producer_id: string) => void;
}
