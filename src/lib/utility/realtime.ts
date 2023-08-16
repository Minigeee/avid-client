import { useEffect, useState } from 'react';
import { mutate } from 'swr';
import assert from 'assert';

import { io, Socket } from 'socket.io-client';

import config from '@/config';
import { SessionState } from '@/lib/contexts';
import { getMemberSync, updateMemberLocal, updateMemberQueryLocal, useApp, useSession } from '@/lib/hooks';
import { ChannelData, ChannelTypes, ClientToServerEvents, ExpandedDomain, Message, ServerToClientEvents } from '@/lib/types';

import { notifyError, errorWrapper } from '@/lib/utility/error-handler';
import notification from '@/lib/utility/notification';

import { merge } from 'lodash';


/** Realtime server socket */
let _socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(config.domains.api, { autoConnect: false });
/** Realtime server socket */
export function socket() { return _socket; }

/**
 * Connect to the realtime server
 * 
 * @param session Session used to authenticate connection
 */
export function connect(session: SessionState) {
	// Only need one connection
	if (_socket.connected) return;

	// Create connection
	_socket = io(config.domains.api, {
		auth: { token: session.token },
	});
	
	// Socket connection error handler
	_socket.on('connect_error', errorWrapper((error) => {
		// Stop trying to connect
		_socket.disconnect();

		if (config.dev_mode) return;
		notifyError(
			error, {
			title: 'Network Error',
			message: `Failed to establish a connection with the realtime server. ${config.app.support_message}`,
			cooldown: 5,
		});
		
	}, { message: 'An error occurred while handling realtime server connection error' }));

	// Server side error notification
	_socket.on('error', (message, status) => {
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
				title: `Realtime Server Error`,
				message: `${'An internal server or database error has occurred'}. ${config.app.support_message}`,
				notify: false,
			});
		}
	});
}


/** Attach realtime event handlers */
export function useRealtimeHandlers() {
	const app = useApp();

	
	// Join/leave handler
	useEffect(() => {
		function onUserJoin(profile_id: string) {
			console.log('trigger')
			updateMemberLocal(profile_id, (member) => ({ ...member, online: true }), false);
			updateMemberQueryLocal(
				(domain, opts) => getMemberSync(domain, profile_id) !== null && opts.online !== undefined,
				(count, domain, opts) => {
					if (opts.online)
						return count + 1;
					else if (!opts.online)
						return count - 1;

					return count;
				}
			);
		}

		function onUserLeft(profile_id: string) {
			updateMemberLocal(profile_id, (member) => ({ ...member, online: false }), false);
			updateMemberQueryLocal(
				(domain, opts) => getMemberSync(domain, profile_id) !== null && opts.online !== undefined,
				(count, domain, opts) => {
					if (opts.online)
						return count - 1;
					else if (!opts.online)
						return count + 1;

					return count;
				}
			);
		}

		_socket.on('general:user-joined', onUserJoin);
		_socket.on('general:user-left', onUserLeft);

		return () => {
			_socket.off('general:user-joined', onUserJoin);
			_socket.off('general:user-left', onUserLeft);
		};
	}, [app]);

	// Channel activity handler
	useEffect(() => {
		function onActivity(domain_id: string, channel_id: string, is_event: boolean) {
			// Set stale, and mark as unseen
			app._mutators.setStale(channel_id, true);

			if (is_event) {
				// UPdate the channel's last event time locally
				mutate(domain_id, (domain: ExpandedDomain | undefined) => {
					if (!domain) return;

					return {
						...domain,
						channels: {
							...domain.channels,
							[channel_id]: {
								...domain.channels[channel_id],
								_last_event: new Date().toISOString(),
							},
						},
					};
				}, { revalidate: false });
			}
		}

		function onPing(domain_id: string, channel_id: string) {
			app._mutators.setPings(channel_id, (app.pings?.[channel_id] || 0) + 1);
		}

		_socket.on('general:activity', onActivity);
		_socket.on('general:ping', onPing);

		return () => {
			_socket.off('general:activity', onActivity);
			_socket.off('general:ping', onPing);
		};
	}, [app]);

	// Rtc handlers
	useEffect(() => {
		// rtc:user-joined
		function onRtcUserJoin(domain_id: string, channel_id: string, profile_id: string) {
			mutate(domain_id, (domain: ExpandedDomain | undefined) => {
				if (!domain) return domain;
				return {
					...domain,
					channels: {
						...domain.channels,
						[channel_id]: {
							...domain.channels[channel_id],
							data: {
								...domain.channels[channel_id].data,
								participants: Array.from(new Set([...(domain.channels[channel_id].data as ChannelData<'rtc'>)?.participants, profile_id])),
							} as ChannelData<'rtc'>,
						},
					},
				};
			}, { revalidate: false });
		}

		// rtc:user-joined
		function onRtcUserLeft(domain_id: string, channel_id: string, profile_id: string) {
			mutate(domain_id, (domain: ExpandedDomain | undefined) => {
				if (!domain) return domain;
				return {
					...domain,
					channels: {
						...domain.channels,
						[channel_id]: {
							...domain.channels[channel_id],
							data: {
								...domain.channels[channel_id].data,
								participants: (domain.channels[channel_id].data as ChannelData<'rtc'>)?.participants.filter(id => id !== profile_id),
							} as ChannelData<'rtc'>,
						},
					},
				};
			}, { revalidate: false });
		}

		_socket.on('rtc:user-joined', onRtcUserJoin);
		_socket.on('rtc:user-left', onRtcUserLeft);

		return () => {
			_socket.off('rtc:user-joined', onRtcUserJoin);
			_socket.off('rtc:user-left', onRtcUserLeft);
		};
	}, []);
}