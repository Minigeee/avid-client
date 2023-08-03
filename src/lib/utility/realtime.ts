import { useEffect, useState } from 'react';
import assert from 'assert';

import { io, Socket } from 'socket.io-client';

import config from '@/config';
import { SessionState } from '@/lib/contexts';
import { getMemberSync, updateMemberLocal, updateMemberQueryLocal, useApp, useSession } from '@/lib/hooks';
import { ClientToServerEvents, Message, ServerToClientEvents } from '@/lib/types';

import { notifyError, errorWrapper } from '@/lib/utility/error-handler';
import notification from '@/lib/utility/notification';


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
		if (!_socket.connected) return;

		function onUserJoin(profile_id: string) {
			updateMemberLocal(profile_id, (member) => ({ ...member, online: true }), false);
			updateMemberQueryLocal(
				(domain, opts) => getMemberSync(domain, profile_id) !== null && opts.online !== undefined,
				(count, domain, opts) => {
					if (opts.online)
						return count + 1;
					else if (opts.online)
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
					else if (opts.online)
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
	}, [_socket.connected, app]);

	// Chat message handler
	useEffect(() => {
		if (!_socket.connected) return;

		function onChatMessage(domain_id: string, message: Message) {
			// If the channel of the message is not the same as the one the user is currently on,
			// mark the message channel as stale
			if (app.channels?.[domain_id] === message.channel) return;

			// Mark stale
			app._mutators.setStale(message.channel, true);
		}

		// Handles marking channels stale
		function onReactionChange(channel_id: string) {
			if (app.channels[app.domain || ''] === channel_id) return;

			// Mark stale
			app._mutators.setStale(channel_id, true);
		}

		_socket.on('chat:message', onChatMessage);
		_socket.on('chat:reactions', onReactionChange);

		return () => {
			_socket.off('chat:message', onChatMessage);
			_socket.off('chat:reactions', onReactionChange);
		};
	}, [_socket.connected, app]);
}