import { useState } from 'react';
import assert from 'assert';

import { parseScalabilityMode } from 'mediasoup-client';
import {
	Consumer,
	Device,
	Producer,
	RtpCapabilities,
	RtpParameters,
	Transport,
	TransportOptions
} from 'mediasoup-client/lib/types';
import { io, Socket } from 'socket.io-client';

import config from '@/config';
import { SessionState } from '@/lib/contexts';
import { useSession } from '@/lib/hooks';
import { Media_ClientToServerEvents, Media_ServerToClientEvents } from '@/lib/types';

import { notifyError, errorWrapper } from '@/lib/utility/error-handler';
import notification from '@/lib/utility/notification';

import { merge } from 'lodash';


/** Video resolution constraints */
const VIDEO_CONSTRAINTS = {
	qvga: { width: { ideal: 320 }, height: { ideal: 240 } },
	vga: { width: { ideal: 640 }, height: { ideal: 480 } },
	hd: { width: { ideal: 1280 }, height: { ideal: 720 } },
};


/** Consumer type (from server) */
type ConsumerType = 'simple' | 'simulcast' | 'svc' | 'pipe';
type ProducerScore = {
    ssrc: number;
    rid?: string;
    score: number;
};
type ConsumerScore = {
    score: number;
    producerScore: number;
    producerScores: number[];
};
/** Consumer variants */
type MediaType = 'audio' | 'video' | 'share';

/** General video options */
type VideoOptions = {
	/** Force VP8 codec */
	force_vp8?: boolean;
	/** Force H264 codec */
	force_h264?: boolean;
	/** Force VP9 codec */
	force_vp9?: boolean;
	/** Number of simulcast streams (simulcast disabled if 1) */
	num_simulcast_streams?: number;
	/** Scalability mode */
	scalability_mode?: string;
	/** Resolution to use */
	resolution?: keyof typeof VIDEO_CONSTRAINTS;
};

/** Webcam options */
type WebcamOptions = VideoOptions & {
	/** The device to use */
	device_id?: string;
};

/** Type representing a consumer's data */
export type RtcConsumer = {
	/** The id of the consumer */
	id: string;
	/** The consumer type */
	type: ConsumerType;
	/** Consumer priority (idk what this does yet) */
	priority: number;
	/** Code the consumer is using */
	codec: string;
	/** The rtp parameters of the consumer */
	rtp_parameters: RtpParameters;
	/** Scalability parameters */
	scalability: {
		/** Spatial scalability */
		spatial: {
			/** Total number of spatial layers available */
			total: number;
			/** The preferred layer */
			preferred: number;
			/** The current layer */
			current: number | null;
		};
		/** Temporal scalability */
		temporal: {
			/** Total number of temporal layers available */
			total: number;
			/** The preferred layer */
			preferred: number;
			/** The current layer */
			current: number | null;
		};
	};

	/** Indicates if consumer data stream is paused */
	paused: {
		/** Indicates if consumer is paused locally */
		local: boolean;
		/** Indicates if consumer is paused remotely */
		remote: boolean;
	};
	/** Track for the remote data stream */
	track: MediaStreamTrack;
};

/** Type representing a participant in an rtc room */
export type RtcParticipant = {
	/** The id of the participant */
	id: string;
	/** Volume of audio streams */
	volume: number;
	/** The mediasoup device of the participant */
	device?: Device;
	/** Consumer data for the producer audio corresponding consumer data */
	audio?: RtcConsumer;
	/** Consumer data for the producer camera video corresponding consumer data */
	video?: RtcConsumer;
	/** Consumer data for the producer screenshare video corresponding consumer data */
	share?: RtcConsumer;
};

/** Type representing public parts of rtc context state */
export type RtcState = {
	/** The id of the room the user is currently in */
	room_id: string;
	/** The id of the domain that contains the room */
	domain_id: string;
	/** The url of the server the user is currently connected to */
	server: string;
	/** Indicates if the client is fully joined to the server */
	joined: boolean;

	/** A map of participants */
	participants: Record<string, RtcParticipant>;
	
	/** The currently selected audio input device id */
	audio_input_device?: string;
	/** Webcam options */
	video_options?: WebcamOptions;
	
	/** Indicates if webcam is enabled */
	is_webcam_enabled: boolean;
	/** Indicates if webcam should be enabled when joining room */
	is_webcam_on: boolean;
	/** Indicates if screen is being shared */
	is_screen_shared: boolean;
	/** Indicates if mic is enabled (connected and available) */
	is_mic_enabled: boolean;
	/** Indicates if mic is muted */
	is_mic_muted: boolean;
	/** Indicates if audio is deafened */
	is_deafened: boolean;
}

type RtcSetState = (state: RtcState) => any;


/** Global rtc state (can only be connected to a single room at any given time) */
let _state: RtcState;

/** Global shared internal state */
const _ = {
	/** Socket used to communicate with rtc server */
	socket: null as Socket<Media_ServerToClientEvents, Media_ClientToServerEvents> | null,
	/** Mediasoup device */
	device: null as Device | null,
	/** Mediasoup send transport */
	sendTransport: null as Transport | null,
	/** Mediasoup recieve transport */
	recvTransport: null as Transport | null,
	/** Map of mediasoup producers */
	producers: {
		/** The mic producer */
		microphone: null as Producer | null,
		/** Webcam producer */
		webcam: null as Producer | null,
		/** Screen share producer */
		screenshare: null as Producer | null,
	},
	/** Map of mediasoup consumers */
	consumers: {} as Record<string, {
		/** The consumer */
		consumer: Consumer;
		/** The corresponding participant id */
		participant_id: string;
	}>,
};


////////////////////////////////////////////////////////////
// Internal helper functions
////////////////////////////////////////////////////////////


/** Attach all event handlers to send transport */
function attachSendTransportHandlers(transport: Transport) {
	transport.on('connect', ({ dtlsParameters }, callback, errback) => {
		assert(_.socket);

		// console.log('send transport "connect"');

		try {
			_.socket.emit('connect-transport', transport.id, dtlsParameters);
			callback();
		}
		catch (err: any) { errback(err); }
	});

	transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
		assert(_.socket);

		// console.log('send transport "produce"')
		/* try {
			// eslint-disable-next-line no-shadow
			const { id } = await options.protoo.request(
				'produce',
				{
					transportId: transport.id,
					kind,
					rtpParameters,
					appData
				});

			callback({ id });
		}
		catch (error) {
			errback(error);
		} */

		try {
			_.socket.emit('produce', transport.id, {
				kind,
				rtpParameters,
				appData
			}, (id) => { console.log(id); callback({ id }); });
		}
		catch (err) { errback(err as Error); }
	});

	transport.on('producedata', async ({
		sctpStreamParameters,
		label,
		protocol,
		appData
	},
		callback,
		errback
	) => {
		console.log('send transport "producedata"')
		/* TODO : logger.debug(
			'"producedata" event: [sctpStreamParameters:%o, appData:%o]',
			sctpStreamParameters, appData);

		try {
			// eslint-disable-next-line no-shadow
			const { id } = await options.protoo.request(
				'produceData',
				{
					transportId: transport.id,
					sctpStreamParameters,
					label,
					protocol,
					appData
				});

			callback({ id });
		}
		catch (error) {
			errback(error);
		} */
	});
}


/** Attach all event handlers to recieve transport */
function attachRecvTransportHandlers(transport: Transport) {
	transport.on('connect', ({ dtlsParameters }, callback, errback) => {
		assert(_.socket);

		// console.log('recv transport "connect"');

		try {
			_.socket.emit('connect-transport', transport.id, dtlsParameters);
			callback();
		}
		catch (err: any) { errback(err); }
	});
}


/** Get consumer field */
function getConsumerField(consumer: Consumer) {
	return consumer.kind === 'audio' ? 'audio' : consumer.appData.share ? 'share' : 'video';
}


/** Pause a consumer locally */
async function pauseConsumer(emit: RtcSetState, participant_id: string, type: MediaType) {
	// Get participant
	const participant = _state.participants[participant_id];
	const consumerInfo = participant?.[type];
	if (!consumerInfo) return;

	// Get consumer
	const { consumer } = _.consumers[consumerInfo.id];

	// Pause consumer
	consumer.pause();
	
	// Send event
	if (_.socket)
		_.socket.emit('consumers-paused', [consumer.id]);

	// Set state
	emit({
		..._state,
		participants: {
			..._state.participants,
			[participant_id]: {
				...participant,
				[type]: {
					...participant[type],
					paused: { ...participant[type]?.paused, local: true },
				},
			}
		},
	});
}

/** Resume a consumer locally */
async function resumeConsumer(emit: RtcSetState, participant_id: string, type: MediaType) {
	// Get participant
	const participant = _state.participants[participant_id];
	const consumerInfo = participant?.[type];
	if (!consumerInfo) return;

	// Get consumer
	const { consumer } = _.consumers[consumerInfo.id];

	// Resume consumer
	consumer.resume();
	
	// Send event
	if (_.socket)
		_.socket.emit('consumers-resumed', [consumer.id]);

	// Set state
	emit({
		..._state,
		participants: {
			..._state.participants,
			[participant_id]: {
				...participant,
				[type]: {
					...participant[type],
					paused: { ...participant[type]?.paused, local: false },
				},
			}
		},
	});
}


/** Enable mic */
async function enableMic(deviceId: string | undefined, emit: RtcSetState) {
	assert(_.device);

	// Quit if producer already exists
	if (_.producers.microphone) return;

	// Check if audio can be produced
	if (!_.device.canProduce('audio')) {
		notification.error(
			'Failed to enable microphone',
			'Your device can not produce microphone audio.'
		);
		
		return;
	}

	// Hold audio track
	let track: MediaStreamTrack | undefined;

	try {
		assert(_.sendTransport);

		// Get mic track
		const stream = await navigator.mediaDevices.getUserMedia(deviceId ? { audio: { deviceId } } : { audio: true });
		const tracks = stream.getAudioTracks();

		if (tracks.length === 0) {
			notification.error(
				'Failed to enable microphone',
				'We couldn\'t detect a microphone. Please make sure you have a microphone device connected and try again.'
			);
			return;
		}
		track = tracks[0];

		// Create producer
		const producer = await _.sendTransport.produce({
			track,
			codecOptions: {
				opusStereo: true,
				opusDtx: true,
				opusFec: true,
			}
		});
		
		/* TODO : if (options.e2eKey && e2e.isSupported())
			e2e.setupSenderTransform(_.producers.microphone.rtpSender); */

		// Save producer
		_.producers.microphone = producer;

		// Attach event listeners
		producer.on('transportclose', () => {
			if (track && _.producers.microphone) {
				_.producers.microphone = null;

				// Mark mic as disabled
				emit({
					..._state,
					is_mic_enabled: false,
				});
			}
		});

		producer.on('trackended', () => {
			// Disable mic
			disableMic(emit);
			
			notification.error(
				'Microphone disconnected',
				'Your microphone has been disconnected. Please make sure it is connected to continue using audio.'
			);
		});

		// Mark mic as enabled
		emit({
			..._state,
			is_mic_enabled: true,
			is_mic_muted: false,
		});
	}
	catch (error: any) {
		notifyError(error, {
			title: 'Failed to enable microphone',
			message: `An error occurred while enabling microphone. ${config.app.support_message}`,
			notify: false,
		});

		if (track)
			track.stop();
	}
}

/** Disable microphone */
async function disableMic(emit: RtcSetState) {
	assert(_.socket);

	// Can't disable if mic isn't enabled
	if (!_.producers.microphone) return;

	// Close producer
	_.producers.microphone.close();

	// Send event
	_.socket.emit('producer-closed', _.producers.microphone.id);

	// Reset
	_.producers.microphone = null;

	// Update state
	emit({
		..._state,
		is_mic_enabled: false,
	});
}

/** Mute microphone */
async function muteMic(emit: RtcSetState) {
	if (_.producers.microphone) {
		// Pause producer
		_.producers.microphone.pause();

		// Send event
		_.socket?.emit('producer-paused', _.producers.microphone.id);
	}

	// Update state
	emit({
		..._state,
		is_mic_muted: true,
	});
}

/** Unmute microphone */
async function unmuteMic(emit: RtcSetState) {
	if (_.producers.microphone) {
		// Resume producer
		_.producers.microphone.resume();

		// Send event
		_.socket?.emit('producer-resumed', _.producers.microphone.id);
	}

	// Update state
	emit({
		..._state,
		is_mic_muted: false,
	});
}


/** Deafen */
async function deafen(emit: RtcSetState) {
	// A new map of participants that have their states changed
	const newParticipantState: Record<string, RtcParticipant> = {};

	// Keep track of consumers that get paused
	const paused: string[] = [];

	// Pause all audio streams
	for (const [pid, participant] of Object.entries(_state?.participants || {})) {
		if (participant.audio) {
			// Get consumer
			const { consumer } = _.consumers[participant.audio.id];

			// Pause consumer
			consumer.pause();

			// Add consumer to list
			paused.push(consumer.id);

			// Update state
			const oldState = newParticipantState[pid] || participant;
			if (oldState.audio) {
				newParticipantState[pid] = {
					...oldState,
					audio: {
						...oldState.audio,
						paused: { ...(oldState.audio.paused), local: true },
					},
				};
			}
		}
	}

	// Send event
	if (_.socket && paused.length > 0)
		_.socket.emit('consumers-paused', paused);

	// Set state
	emit({
		..._state,
		participants: { ..._state.participants, ...newParticipantState },
		is_deafened: true,
	});
}

/** Undeafen */
async function undeafen(emit: RtcSetState) {
	// A new map of participants that have their states changed
	const newParticipantState: Record<string, RtcParticipant> = {};

	// Keep track of consumers that get resumed
	const resumed: string[] = [];

	// Resume all audio streams
	for (const [pid, participant] of Object.entries(_state?.participants || {})) {
		if (participant.audio) {
			// Get consumer
			const { consumer } = _.consumers[participant.audio.id];

			// Resume consumer
			consumer.resume();

			// Add consumer to list
			resumed.push(consumer.id);

			// Update state
			const oldState = newParticipantState[pid] || participant;
			if (oldState.audio) {
				newParticipantState[pid] = {
					...(oldState),
					audio: {
						...oldState.audio,
						paused: { ...(oldState.audio.paused), local: false },
					},
				};
			}
		}
	}

	// Send event
	if (_.socket && resumed.length > 0)
		_.socket.emit('consumers-resumed', resumed);

	// Set state
	emit({
		..._state,
		participants: { ..._state.participants, ...newParticipantState },
		is_deafened: false,
	});
}


/** Enable webcam */
async function enableWebcam(emit: RtcSetState, options?: WebcamOptions) {
	assert(_.device && _.sendTransport);
	
	// Quit if producer already exists
	if (_.producers.webcam) return;

	// Check if video can be produced
	if (!_.device.canProduce('video')) {
		notification.error(
			'Failed to enable webcam',
			'Your device can not produce video.'
		);
		
		return;
	}

	// Hold video track
	let track: MediaStreamTrack | undefined;

	// Defaults
	options = {
		...(options || {}),
		num_simulcast_streams: options?.num_simulcast_streams || 0,
	};

	try {
		// Get media stream
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: false,
			video: {
				deviceId: options.device_id ? { ideal: options.device_id } : undefined,
				...VIDEO_CONSTRAINTS[options.resolution || 'hd'],
			}
		});
		const tracks = stream.getVideoTracks();

		if (tracks.length === 0) {
			notification.error(
				'Failed to enable webcam',
				'We couldn\'t detect a webcam. Please make sure you have a webcam device connected and try again.'
			);
			return;
		}
		track = tracks[0];
		
		let encodings;
		let codec;
		const codecOptions = {
			videoGoogleStartBitrate: 1000
		};
	
		if (options.force_vp8) {
			codec = _.device.rtpCapabilities.codecs
				?.find((c) => c.mimeType.toLowerCase() === 'video/vp8');
	
			if (!codec) {
				throw new Error('desired VP8 codec+configuration is not supported');
			}
		}
		else if (options.force_h264) {
			codec = _.device.rtpCapabilities.codecs
				?.find((c) => c.mimeType.toLowerCase() === 'video/h264');
	
			if (!codec) {
				throw new Error('desired H264 codec+configuration is not supported');
			}
		}
		else if (options.force_vp9) {
			codec = _.device.rtpCapabilities.codecs
				?.find((c) => c.mimeType.toLowerCase() === 'video/vp9');
	
			if (!codec) {
				throw new Error('desired VP9 codec+configuration is not supported');
			}
		}

		if (options.num_simulcast_streams && options.num_simulcast_streams > 0) {
			// If VP9 is the only available video codec then use SVC.
			const firstVideoCodec = _.device.rtpCapabilities.codecs?.find((c) => c.kind === 'video');

			// VP9 with SVC.
			if (
				(options.force_vp9 && codec) ||
				firstVideoCodec?.mimeType.toLowerCase() === 'video/vp9'
			) {
				encodings = [{
					maxBitrate: 5000000,
					scalabilityMode: options.scalability_mode || 'L3T3_KEY',
				}];
			}
			// VP8 or H264 with simulcast.
			else {
				encodings = [{
					scaleResolutionDownBy: 1,
					maxBitrate: 5000000,
					scalabilityMode: options.scalability_mode || 'L1T3',
				}];

				if (options.num_simulcast_streams > 1) {
					encodings.unshift({
						scaleResolutionDownBy: 2,
						maxBitrate: 1000000,
						scalabilityMode: options.scalability_mode || 'L1T3',
					});
				}

				if (options.num_simulcast_streams > 2) {
					encodings.unshift({
						scaleResolutionDownBy: 4,
						maxBitrate: 500000,
						scalabilityMode: options.scalability_mode || 'L1T3',
					});
				}
			}
		}

		// Create producer
		const producer = await _.sendTransport.produce({
			track,
			encodings,
			codecOptions,
			codec,
		});
		
		/* TODO : if (this._e2eKey && e2e.isSupported())
			e2e.setupSenderTransform(_.producers._webcamProducer.rtpSender); */

		// Save producer
		_.producers.webcam = producer;

		// Attach event listeners
		producer.on('transportclose', () => {
			if (track && _.producers.webcam) {
				_.producers.webcam = null;

				// Mark webcam as disabled
				emit({
					..._state,
					is_webcam_enabled: false,
				});
			}
		});

		producer.on('trackended', () => {
			// Disable webcam
			disableWebcam(emit);
			
			notification.info(
				'Webcam',
				'Your webcam has been disconnected.'
			);
		});

		// Mark webcam as enabled
		emit({
			..._state,
			is_webcam_enabled: true,
			is_webcam_on: true,
		});

	}
	catch (error: any) {
		notifyError(error, {
			title: 'Failed to enable webcam',
			message: `An error occurred while enabling webcam. ${config.app.support_message}`,
			notify: false,
		});

		if (track)
			track.stop();
	}
}

/** Disable webcam */
async function disableWebcam(emit: RtcSetState) {
	assert(_.socket);

	if (!_.producers.webcam) return;

	// Close producer
	_.producers.webcam.close();

	// Send event
	_.socket.emit('producer-closed', _.producers.webcam.id);

	// Reset
	_.producers.webcam = null;

	// Update state
	emit({
		..._state,
		is_webcam_enabled: false,
		is_webcam_on: false,
	});
}


/** Enable screen share */
async function enableShare(emit: RtcSetState, options?: VideoOptions) {
	assert(_.device && _.sendTransport);
	
	// Quit if producer already exists
	if (_.producers.screenshare) return;

	// Check if video can be produced
	if (!_.device.canProduce('video')) {
		notification.error(
			'Failed to enable screen share',
			'Your device can not produce video.'
		);
		
		return;
	}

	// Hold video track
	let track: MediaStreamTrack | undefined;

	// Defaults
	options = {
		...(options || {}),
		num_simulcast_streams: options?.num_simulcast_streams || 0,
	};

	try {
		// Get screen share track
		const stream = await navigator.mediaDevices.getDisplayMedia({
			audio: false,
			video: {
				width: { max: 1280 },
				height: { max: 720 },
				frameRate: { max: 30 }
			}
		});
		if (!stream) return;
		track = stream.getVideoTracks()[0];
		
		let encodings;
		let codec;
		const codecOptions = {
			videoGoogleStartBitrate: 1000
		};
	
		if (options.force_vp8) {
			codec = _.device.rtpCapabilities.codecs
				?.find((c) => c.mimeType.toLowerCase() === 'video/vp8');
	
			if (!codec) {
				throw new Error('desired VP8 codec+configuration is not supported');
			}
		}
		else if (options.force_h264) {
			codec = _.device.rtpCapabilities.codecs
				?.find((c) => c.mimeType.toLowerCase() === 'video/h264');
	
			if (!codec) {
				throw new Error('desired H264 codec+configuration is not supported');
			}
		}
		else if (options.force_vp9) {
			codec = _.device.rtpCapabilities.codecs
				?.find((c) => c.mimeType.toLowerCase() === 'video/vp9');
	
			if (!codec) {
				throw new Error('desired VP9 codec+configuration is not supported');
			}
		}

		if (options.num_simulcast_streams && options.num_simulcast_streams > 0) {
			// If VP9 is the only available video codec then use SVC.
			const firstVideoCodec = _.device.rtpCapabilities.codecs?.find((c) => c.kind === 'video');

			// VP9 with SVC.
			if (
				(options.force_vp9 && codec) ||
				firstVideoCodec?.mimeType.toLowerCase() === 'video/vp9'
			) {
				encodings = [{
					maxBitrate: 5000000,
					scalabilityMode: options.scalability_mode || 'L3T3',
					dtx: true
				}];
			}
			// VP8 or H264 with simulcast.
			else {
				encodings = [{
					scaleResolutionDownBy: 1,
					maxBitrate: 5000000,
					scalabilityMode: options.scalability_mode || 'L1T3',
					dtx: true
				}];

				if (options.num_simulcast_streams > 1) {
					encodings.unshift({
						scaleResolutionDownBy: 2,
						maxBitrate: 1000000,
						scalabilityMode: options.scalability_mode || 'L1T3',
						dtx: true
					});
				}

				if (options.num_simulcast_streams > 2) {
					encodings.unshift({
						scaleResolutionDownBy: 4,
						maxBitrate: 500000,
						scalabilityMode: options.scalability_mode || 'L1T3',
						dtx: true
					});
				}
			}
		}

		// Create producer
		const producer = await _.sendTransport.produce({
			track,
			encodings,
			codecOptions,
			codec,
			appData: { share: true },
		});
		
		/* TODO : if (this._e2eKey && e2e.isSupported())
			e2e.setupSenderTransform(_.producers._shareProducer.rtpSender); */

		// Save producer
		_.producers.screenshare = producer;

		// Attach event listeners
		producer.on('transportclose', () => {
			if (track && _.producers.screenshare) {
				_.producers.screenshare = null;

				// Mark screen share as off
				emit({
					..._state,
					is_screen_shared: false,
				});
			}
		});

		producer.on('trackended', () => {
			// Disable screen share
			disableShare(emit);
			
			notification.info(
				'Stopped Sharing',
				'Screen share has been stopped due to an external reason.'
			);
		});

		// Mark mic as enabled
		emit({
			..._state,
			is_screen_shared: true,
		});
	}
	catch (error: any) {
		notifyError(error, {
			title: 'Failed to enable screen share',
			message: `An error occurred while enabling screen share. ${config.app.support_message}`,
			notify: false,
		});

		if (track)
			track.stop();
	}
}

/** Disable screen share */
async function disableShare(emit: RtcSetState) {
	assert(_.socket);

	if (!_.producers.screenshare) return;

	// Close producer
	_.producers.screenshare.close();

	// Send event
	_.socket.emit('producer-closed', _.producers.screenshare.id);

	// Reset
	_.producers.screenshare = null;

	// Update state
	emit({
		..._state,
		is_screen_shared: false,
	});
}


////////////////////////////////////////////////////////////
// Internal rtc functions
////////////////////////////////////////////////////////////


/** Create mediasoup device and send + recieve transports */
async function makeMediasoupDevice(capabilities: RtpCapabilities, producerConfig: TransportOptions, consumerConfig: TransportOptions) {
	// New device
	_.device = new Device();

	// Load capabilities sent from server
	await _.device.load({ routerRtpCapabilities: capabilities });

	// NOTE: Stuff to play remote audios due to browsers' new autoplay policy.
	//
	// Just get access to the mic and DO NOT close the mic track for a while.
	// Super hack!
	{
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		const audioTrack = stream.getAudioTracks()[0];

		audioTrack.enabled = false;

		setTimeout(() => audioTrack.stop(), 120000);
	}

	// Create send transport
	if (producerConfig) {
		const {
			id,
			iceParameters,
			iceCandidates,
			dtlsParameters,
			sctpParameters
		} = producerConfig;

		_.sendTransport = _.device.createSendTransport({
			id,
			iceParameters,
			iceCandidates,
			dtlsParameters: {
				...dtlsParameters,
				// Remote DTLS role. We know it's always 'auto' by default so, if
				// we want, we can force local WebRTC transport to be 'client' by
				// indicating 'server' here and vice-versa.
				role: 'auto'
			},
			sctpParameters,
			iceServers: [],
			// TODO : additionalSettings: { encodedInsertableStreams: options.e2eKey && e2e.isSupported() }
		});

		// Attach handlers
		attachSendTransportHandlers(_.sendTransport);
	}

	// Create recieve transport
	if (consumerConfig) {
		const {
			id,
			iceParameters,
			iceCandidates,
			dtlsParameters,
			sctpParameters
		} = consumerConfig;

		_.recvTransport = _.device.createRecvTransport({
			id,
			iceParameters,
			iceCandidates,
			dtlsParameters: {
				...dtlsParameters,
				// Remote DTLS role. We know it's always 'auto' by default so, if
				// we want, we can force local WebRTC transport to be 'client' by
				// indicating 'server' here and vice-versa.
				role: 'auto'
			},
			sctpParameters,
			iceServers: [],
			// TODO : additionalSettings: { encodedInsertableStreams: options.e2eKey && e2e.isSupported() }
		});

		// Attach handlers
		attachRecvTransportHandlers(_.recvTransport);
	}
}


/** Make a socket for rtc */
function makeRtcSocket(server: string, room_id: string, session: SessionState, emit: RtcSetState) {
	// Initialize connection, this connects to the specified media server
	// with the room id to connect to. The server will create the server-side transports
	// and send transport config and rtp capabilities to the client through the 'config' event
	_.socket = io(server, {
		query: { room_id },
		auth: { token: session.token },
	});

	// Socket connection error handler
	_.socket.on('connect_error', errorWrapper((error) => {
		assert(_.socket);
	
		notifyError(
			error, {
			title: 'Network Error',
			message: `Failed to establish a connection with the RTC media server. ${config.app.support_message}`,
			cooldown: 5,
		});

		// Stop trying to connect
		_.socket.disconnect();
	}, { message: 'An error occurred while handling RTC server connection error' }));

	// Server side error notification
	_.socket.on('error', (message, status) => {
		if (status === 401) {
			notifyError(new Error(message), {
				title: `Authentication Error`,
				message: 'You do not have valid credentials.',
				notify: false,
			});
		}
		else if (status === 403) {
			notifyError(new Error(message), {
				title: `Authorization Error`,
				message: 'You are not authorized to perform the requested action. Please make sure you have the correct permissions.',
				notify: false,
			});
		}
		else {
			notifyError(new Error(message), {
				title: `Server Error`,
				message: `An internal server or database error has occurred. ${config.app.support_message}`,
				notify: false,
			});
		}
	});


	// Called after server-side transports have been created. Client creates the mediasoup
	// device and client-side transports and returns its own device and rtp/sctp capabilities
	_.socket.on('config', errorWrapper(async (capabilities: RtpCapabilities, producerConfig: TransportOptions, consumerConfig: TransportOptions) => {
		assert(_.socket);
	
		// Set up mediasoup device
		await makeMediasoupDevice(capabilities, producerConfig, consumerConfig);
		if (!_.device) return;

		// Send client config
		_.socket.emit('config', _.device, _.device.rtpCapabilities, _.device.sctpCapabilities);
	}, { message: 'An error occurred while setting up RTC device' }));

	// Called after server has received client's capabilities and the client has been flagged as joined
	// The client is now able to enable microphone, webcam, and screen share
	_.socket.on('joined', errorWrapper(async (participant_ids: string[], callback: () => void) => {
		// Create map of participants
		const participants: Record<string, { id: string; volume: number }> = {};
		for (const id of participant_ids)
			participants[id] = { id, volume: 100 };

		// Mark as joined, and add initial participants
		emit({
			..._state,
			joined: true,
			participants,
		});

		// Acknowledge that client is ready to create consumers
		callback();

		// Enable microphone
		if (!_state.is_mic_muted)
			enableMic(_state.audio_input_device, emit);
		// Enable webcam
		if (_state.is_webcam_on)
			enableWebcam(emit, _state.video_options);

		// TODO : Enable webcam
	}, { message: 'An error occurred while setting up RTC data producers' }));

	// Called whenever a new server-side consumer is created (i.e. when a new producer within the room is created)
	// and the client should create a client-side consumer
	_.socket.on('make-consumer', errorWrapper(async (options, callback: (success: boolean) => void) => {
		assert(_.recvTransport);
	
		const {
			peerId,
			producerId,
			id,
			kind,
			rtpParameters,
			type,
			appData,
			producerPaused
		} = options;

		try {
			const consumer = await _.recvTransport.consume({
				id,
				producerId,
				kind,
				rtpParameters,
				// NOTE: Force streamId to be same in mic and webcam and different
				// in screen sharing so libwebrtc will just try to sync mic and
				// webcam streams from the same remote peer.
				streamId: `${peerId}-${appData.share ? 'share' : 'mic-webcam'}`,
				appData: { ...appData, peerId } // Trick.
			});

			/* TODO : if (options.e2eKey && e2e.isSupported())
				e2e.setupReceiverTransform(consumer.rtpReceiver); */

			// Save consumer
			_.consumers[consumer.id] = {
				consumer,
				participant_id: peerId,
			};

			// Attach consumer event handlers
			consumer.on('transportclose', () => {
				delete _.consumers[consumer.id];
			});

			// Get scalability info
			const { spatialLayers, temporalLayers } = parseScalabilityMode(
				consumer.rtpParameters.encodings?.[0].scalabilityMode
			);

			// Create new consumer data
			const cdata: RtcConsumer = {
				id: consumer.id,
				type: type,
				priority: 1,
				codec: consumer.rtpParameters.codecs[0].mimeType.split('/')[1],
				rtp_parameters: consumer.rtpParameters,
				scalability: {
					spatial: {
						total: spatialLayers,
						preferred: spatialLayers - 1,
						current: null,
					},
					temporal: {
						total: temporalLayers,
						preferred: temporalLayers - 1,
						current: null,
					},
				},
				paused: {
					local: false,
					remote: producerPaused,
				},
				track: consumer.track,
			};

			// Get field
			const field = getConsumerField(consumer);
			console.log(field)

			// Emit state changes
			emit({
				..._state,
				participants: {
					..._state.participants,
					[peerId]: {
						...(_state.participants[peerId] || {
							// Default new consumer state
							id: peerId,
							volume: 100,
						}),
						[field]: cdata,
					},
				},
			});

			// Done
			callback(true);
		}
		catch (error) {
			// Failed to create consumer
			callback(false);

			// Propagate error
			throw error;
		}
	}, { message: 'An error occurred while creating RTC consumer' }));

	// Called when a new participant joins the room
	_.socket.on('participant-joined', errorWrapper((participant_id: string) => {
		// Create a new entry in rtc state
		emit({
			..._state,
			participants: {
				..._state.participants,
				[participant_id]: {
					..._state.participants[participant_id],
					id: participant_id,
					volume: 100,
				}
			},
		});
	}, { message: 'An error occurred while updating RTC state' }));

	// Called when a participant leaves the room
	_.socket.on('participant-left', errorWrapper((participant_id: string) => {
		// Remove the entry in the participants map
		const participants = { ..._state.participants };
		if (participants[participant_id])
			delete participants[participant_id];

		// Update state
		emit({
			..._state,
			participants,
		});
	}, { message: 'An error occurred while updating RTC state' }));

	// Called when a consumer closes for any reason
	_.socket.on('consumer-closed', errorWrapper((consumer_id: string) => {
		// Get consumer info
		const info = _.consumers[consumer_id];
		if (!info) return;

		// Close consumer
		info.consumer.close();

		// Remove from consumer map
		delete _.consumers[consumer_id];

		// Remove from participant in rtc state
		if (!_state.participants[info.participant_id]) return;

		const field = getConsumerField(info.consumer);
		emit({
			..._state,
			participants: {
				..._state.participants,
				[info.participant_id]: {
					..._state.participants[info.participant_id],
					[field]: undefined,
				}
			},
		});
	}, { message: 'An error occurred while updating RTC state' }));

	// Called when a consumer is paused from the server side
	_.socket.on('consumer-paused', errorWrapper((consumer_id: string) => {
		// Get consumer info
		const info = _.consumers[consumer_id];
		if (!info) return;

		// Pause consumer
		info.consumer.pause();

		// Update consumer paused state
		const field = getConsumerField(info.consumer);
		const participant = _state.participants[info.participant_id];

		if (!participant) return;
		emit({
			..._state,
			participants: {
				..._state.participants,
				[info.participant_id]: {
					...participant,
					[field]: {
						...participant[field],
						paused: { ...participant[field]?.paused, remote: true }
					},
				}
			},
		});
	}, { message: 'An error occurred while updating RTC state' }));

	// Called when a consumer is resumed from the server side
	_.socket.on('consumer-resumed', errorWrapper((consumer_id: string) => {
		// Get consumer info
		const info = _.consumers[consumer_id];
		if (!info) return;

		// Resume consumer
		info.consumer.resume();

		// Update consumer paused state
		const field = info.consumer.kind;
		const participant = _state.participants[info.participant_id];

		if (!participant) return;
		emit({
			..._state,
			participants: {
				..._state.participants,
				[info.participant_id]: {
					...participant,
					[field]: {
						...participant[field],
						paused: { ...participant[field]?.paused, remote: false }
					},
				}
			},
		});
	}, { message: 'An error occurred while updating RTC state' }));

	// Called when a consumer is resumed from the server side
	_.socket.on('consumer-layers-changed', errorWrapper((consumer_id: string, spatial: number, temporal: number) => {
		// Get consumer info
		const info = _.consumers[consumer_id];
		if (!info) return;

		// Update current consumer layers
		const field = info.consumer.kind;
		const participant = _state.participants[info.participant_id];
		console.log('consumer-layers-changed', participant)

		if (!participant) return;
		emit({
			..._state,
			participants: {
				..._state.participants,
				[info.participant_id]: {
					...participant,
					[field]: {
						...participant[field],
						scalability: {
							spatial: { ...participant[field]?.scalability.spatial, current: spatial },
							temporal: { ...participant[field]?.scalability.temporal, current: temporal },
						},
					},
				}
			},
		});
	}, { message: 'An error occurred while updating RTC state' }));

	// Called when server updates a consumer's score
	_.socket.on('consumer-score', errorWrapper((consumer_id: string, score: ConsumerScore) => {
		// TODO : Use consumer score
	}, { message: 'An error occurred while updating RTC state' }));

	// Called when server updates a producer's score
	_.socket.on('producer-score', errorWrapper((producer_id: string, score: ProducerScore) => {
		// TODO : Use producer score
	}, { message: 'An error occurred while updating RTC state' }));
}


/** Disconnect from current server */
function disconnect(emit: RtcSetState) {
	// Close socket
	if (_.socket?.connected)
		_.socket.disconnect();

	// Close send transport
	if (_.sendTransport && !_.sendTransport.closed)
		_.sendTransport.close();
		
	// Close receive transport
	if (_.recvTransport && !_.recvTransport.closed)
		_.recvTransport.close();

	// Set joined status
	if (_state)
		emit({ ..._state, joined: false });

	// Reset data structures
	_.producers = {
		microphone: null,
		webcam: null,
		screenshare: null,
	};
	_.consumers = {};
}


////////////////////////////////////////////////////////////
// Public functions
////////////////////////////////////////////////////////////


/** Get rtc context state and mutators */
export function useRtc(session: SessionState) {
	const [state, setState] = useState<RtcState | undefined>(_state);

	return {
		rtc: state,
		mutators: {
			/**
			 * Connect to an RTC room
			 * 
			 * @param room_id The id of the room to connect to
			 * @param domain_id The domain the room belongs to (currently only used for UI navigation)
			 */
			connect: async (room_id: string, domain_id?: string) => {
				const emit = (state: RtcState) => { _state = state; setState(state); };

				// TODO : Choose a server (assign a new server if room is empty)
				const url: string = config.app.rtc.servers[0];

				// Disconnect if already connected to a different room
				if (_state?.joined) {
					if (_state.room_id !== room_id)
						disconnect(emit);
					else
						// Quit if already connected to the specified room
						return;
				}

				// Reset state
				_state = {
					// Keep certain options
					...merge({
						is_webcam_enabled: false,
						is_webcam_on: true,
						is_screen_shared: false,
						is_mic_enabled: false,
						is_mic_muted: false,
						is_deafened: false,
					}, _state || {}),

					room_id,
					domain_id: domain_id || '',
					server: url,
					joined: false,
					participants: {},
				};

				// Connect to server
				makeRtcSocket(url, room_id, session, emit);

				// Set new state
				setState(_state);
			},

			/** Disconnects from the currently connected room */
			disconnect: () => disconnect((state) => { _state = state; setState(state); }),

			/** Screen share state mutators */
			webcam: {
				/**
				 * Enable webcam. If not connected to a room, then webcam will be enabled
				 * when connecting to a room.
				 * 
				 * @param options Webcam options. Default state options are used if this is not provided
				 */
				enable: (options?: WebcamOptions) => {
					// Enable if connected
					if (_state?.joined && !_state?.is_webcam_enabled)
						enableWebcam((state) => { _state = state; setState(state); }, options || _state.video_options);

					// Otherwise queue webcam enable
					else {
						_state = {
							...(_state || {}),
							is_webcam_on: true,
						};
						setState(_state);
					}
				},

				/**
				 * Disable webcam. If not connected to a room, it will not be enabled when
				 * connecting to a room.
				 */
				disable: () => {
					// Disable if connected
					if (_state?.joined && _state?.is_webcam_enabled)
						disableWebcam((state) => { _state = state; setState(state); });

					// Otherwise queue disable
					else {
						_state = {
							...(_state || {}),
							is_webcam_on: false,
						};
						setState(_state);
					}
				},

				/**
				 * Set webcam options
				 * 
				 * @param options Webcam options
				 */
				setOptions: (options: WebcamOptions) => setState({ ..._state, video_options: options }),
			},

			/** Screen share state mutators */
			screenshare: {
				/**
				 * Enable screen sharing. Must be connected to a room to enable.
				 * Does nothing if screen share is already enabled.
				 * 
				 * @param options Screenshare options
				 */
				enable: (options?: VideoOptions) => enableShare((state) => { _state = state; setState(state); }, options),

				/**
				 * Disable screen sharing. Does nothing if screen sharing is not enabled.
				 */
				disable: () => disableShare((state) => { _state = state; setState(state); }),
			},

			/** Audio state mutators */
			audio: {
				/**
				 * Deafens all participants. Must be connected to a room to deafen.
				 * Does nothing if already deafened.
				 */
				deafen: () => deafen((state) => { _state = state; setState(state); }),

				/**
				 * Undeafen all participants. Does nothing if already undeafened.
				 */
				undeafen: () => undeafen((state) => { _state = state; setState(state); }),

				/**
				 * Set the volume of a single participant on a scale of 0 to 100.
				 * 
				 * @param participant_id The id of the participant to set volume for
				 * @param volume The volume to set (0-100)
				 */
				setVolume: (participant_id: string, volume: number) => {
					if (!_state.participants[participant_id]) return;

					// If volume is 0, pause consumer
					if (volume <= 0 && !_state.participants[participant_id].audio?.paused.local)
						pauseConsumer((state) => { _state = state; setState(state); }, participant_id, 'audio');
					else if (volume > 0 && _state.participants[participant_id].audio?.paused.local)
						resumeConsumer((state) => { _state = state; setState(state); }, participant_id, 'audio');

					// Create new state
					const newState: RtcState = {
						..._state,
						participants: {
							..._state.participants,
							[participant_id]: { ..._state.participants[participant_id], volume },
						},
					};

					// Update state
					_state = newState;
					setState(newState);
				}
			},

			/** Microphone state mutators */
			microphone: {
				/**
				 * Enables microphone. Must be connected to a room to enable.
				 * Does nothing if microphone is already enabled.
				 * 
				 * @param device_id The id of the input device to use. Default state device is used if this is not provided
				 */
				enable: (device_id?: string) => enableMic(device_id || _state.audio_input_device, (state) => { _state = state; setState(state); }),

				/**
				 * Disables microphone. Does nothing if microphone is already disabled.
				 */
				disable: () => disableMic((state) => { _state = state; setState(state); }),

				/**
				 * Mutes microphone. Does nothing if microphone is already muted.
				 * If microphone is not enabled, it will be muted when it is enabled.
				 */
				mute: () => muteMic((state) => { _state = state; setState(state); }),

				/**
				 * Unmutes microphone. Does nothing if microphone is already unmuted.
				 * If microphone is not enabled, it will be unmuted when it is enabled.
				 */
				unmute: () => unmuteMic((state) => { _state = state; setState(state); }),

				/**
				 * Choose an audio input device
				 * 
				 * @param device_id The id of the audio input device
				 */
				setDevice: (device_id: string | undefined) => setState({ ..._state, audio_input_device: device_id }),
			},

			/**
			 * Pause a consumer for the given participant and consumer variant.
			 * If the participant does not exist, or the participant is not a producer
			 * of the given media type, nothing happens.
			 * 
			 * @param participant_id The id of the participant to pause
			 * @param type The media type to pause
			 */
			pause: (participant_id: string, type: MediaType) => pauseConsumer((state) => { _state = state; setState(state); }, participant_id, type),
			
			/**
			 * Resume a consumer for the given participant and consumer variant.
			 * If the participant does not exist, or the participant is not a producer
			 * of the given media type, nothing happens.
			 * 
			 * @param participant_id The id of the participant to resume
			 * @param type The media type to resume
			 */
			resume: (participant_id: string, type: MediaType) => resumeConsumer((state) => { _state = state; setState(state); }, participant_id, type),
		},
	};
}

/** Rtc context state mutators */
export type RtcMutators = ReturnType<typeof useRtc>['mutators'];

export function rtcIo() { return _.socket; }