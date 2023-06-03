import { useMemo } from 'react';
import assert from 'assert';

import useSWR, { KeyedMutator } from 'swr';
import useSWRInfinite from 'swr/infinite';

import config from '@/config';
import { uploadAttachments } from '@/lib/api';
import { SessionState } from '@/lib/contexts';
import { getMember, getMemberSync, getMembers, query, sql } from '@/lib/db';
import { ExpandedMessage, FileAttachment, Member, Message, Role } from '@/lib/types';

import { DomainWrapper } from './use-domain';
import { MemberWrapper } from './use-members';
import { useSession } from './use-session';
import { SwrWrapper, useSwrWrapper } from './use-swr-wrapper';

import { SyncCache } from '@/lib/utility/cache';
import { swrErrorWrapper } from '@/lib/utility/error-handler';
import { socket } from '@/lib/utility/realtime';

import hljs from 'highlight.js';
import { groupBy } from 'lodash';
import MarkdownIt from 'markdown-it';
import moment from 'moment';
import shash from 'string-hash';
import { v4 as uuid } from 'uuid';

import sanitizeHtml from 'sanitize-html';


/** An expanded message with information on if a target member was pinged within message */
export type ExpandedMessageWithPing = ExpandedMessage & {
	/** Determines if the target member was pinged */
	pinged: boolean;
};

/** Type for grouped messages within a channel. It is grouped by day, then by sender */
export type GroupedMessages = Record<string, ExpandedMessageWithPing[][]>;

////////////////////////////////////////////////////////////
type MarkdownEnv = {
	domain: {
		id: string;
		roles?: Record<string, Role>;
	};
};


/** Markdown renderer */
const _md = new MarkdownIt({
	linkify: true,
	breaks: true,

	highlight: (str, lang) => {
		if (lang && hljs.getLanguage(lang)) {
			try {
				const result = hljs.highlight(str, { language: lang }).value;
				return result;
			} catch (__) { }
		}

		return ''; // use external default escaping
	}
})
	.use(require('markdown-it-sub'))
	.use(require('markdown-it-sup'))
	.use(require('markdown-it-mark'))
	.use(require('markdown-it-texmath'), {
		engine: require('katex'),
		delimiters: 'dollars',
	})
	.use((md) => {
		md.inline.ruler.after('emphasis', 'mentions', (state, silent) => {
			var found,
				content,
				token,
				max = state.posMax,
				start = state.pos;

			if (state.src.at(start) !== '@') { return false; }

			const mtype = config.app.message.member_mention_chars;
			const rtype = config.app.message.role_mention_chars;

			// Mention type
			let type = state.src.at(start + 1);
			if (type === mtype[0])
				type = mtype[1];
			else if (type === rtype[0])
				type = rtype[1];
			else
				return false;

			// Make sure all valid characters
			let i = 0;
			for (; i < config.app.message.max_mention_length; ++i) {
				const idx = start + 2 + i;
				const c = state.src.charCodeAt(idx);

				if (c < 48 || (c > 57 && c < 65) || (c > 90 && c < 97 && c !== 95) || c > 122) {
					if (state.src.at(idx) === type)
						break;
					else
						return false;
				}
			}
			if (i === config.app.message.max_mention_length)
				return false;

			// Valid mention, get id
			content = state.src.slice(start + 2, start + 2 + i);

			// Create token
			const ttype = type === mtype[1] ? 'mention_member' : type === rtype[1] ? 'mention_role' : 'mention_channel';
			token = state.push(ttype, '', 0);
			token.content = content;

			// Update position
			state.pos = start + 3 + i;

			return true;
		});

		md.renderer.rules.mention_member = (tokens, idx, opts, env: MarkdownEnv) => {
			const id = `profiles:${tokens[idx].content}`;
			const alias = env.domain?.id ? getMemberSync(env.domain.id, id)?.alias || '_' : '_';
			return `<span class="avid-highlight avid-mention-member" data-type="pingMention" data-id="${id}" data-variant="member" data-label="${alias}">@${alias}</span>`;
		}

		md.renderer.rules.mention_role = (tokens, idx, opts, env: MarkdownEnv) => {
			const id = `roles:${tokens[idx].content}`;
			const role = env.domain?.roles?.[id];
			const name = role?.label || '_';
			const color = role?.color || '#EAECEF';
			return `<span class="avid-highlight" data-type="pingMention" data-id="${id}" data-variant="member" data-label="${name}" data-color="${color}" style="background-color: ${color}2A; color: ${color}; font-weight: 600;">@${name}</span>`;
		}
	});


/** Caches */
let _cache = {
	message: {} as Record<string, { hash: number, rendered: string }>,
}


/** Find message within pages */
function findMessage(messages: ExpandedMessageWithPing[][], message_id: string) {
	// Find message, search from last
	let page = messages.length - 1;
	let idx = -1;
	for (; page >= 0; --page) {
		idx = messages[page].findIndex(x => x.id === message_id);
		if (idx >= 0)
			break;
	}

	return { page, idx };
}

/** Finds all mentions in message */
function findMentions(message: string) {
	const mtype = config.app.message.member_mention_chars;
	const rtype = config.app.message.role_mention_chars;

	// Map of mentions
	const mentions = {
		members: new Set<string>(),
		roles: new Set<string>(),
	};

	message.match(/@[\[\{]\w+[\]\}]/g)?.forEach((match) => {
		// Check ention type
		let type = match.at(1);
		if (type === mtype[0])
			type = mtype[1];
		else if (type === rtype[0])
			type = rtype[1];
		else
			// Not a mention
			return;

		// Check if closing bracket is correct
		if (match.at(-1) !== type) return;

		// Get id
		const id = match.substring(2, match.length - 1);

		if (type === mtype[1])
			mentions.members.add(`profiles:${id}`);
		else if (type === rtype[1])
			mentions.roles.add(`roles:${id}`);
	});

	return mentions;
}

/** Checks message for reader pings */
function hasPings(message: string, reader: Member) {
	// Analyze message for mentions
	const mentions = findMentions(message);

	let pinged = mentions.members.has(reader.id);
	if (reader.roles) {
		for (let i = 0; !pinged && i < reader.roles.length; ++i)
			pinged = mentions.roles.has(reader.roles[i]);
	}

	return { mentions, pinged };
}

/** Render a single message */
function renderMessage(id: string, message: string, env: MarkdownEnv) {
	// Keep only random part of message id
	id = id.split(':').at(-1) || '';
	assert(id);

	// Generate hash of new message
	const hash = shash(message);

	// Return cached value if it exists and hasn't changed
	if (_cache.message[id] && _cache.message[id].hash === hash)
		return _cache.message[id].rendered;

	// Render new message
	const rendered = _md.render(message, env);

	// Add to cache
	_cache.message[id] = { hash, rendered };

	return rendered;
}

/** Add a single message to a day group message */
function addMessageToDayGroup(group: ExpandedMessageWithPing[][], msg: ExpandedMessageWithPing) {
	const prevMsg = group.at(-1)?.at(-1);

	// First check if the senders are the same
	if (msg.sender?.id !== prevMsg?.sender?.id)
		// Not the same, start a new sender group
		group.push([]);

	else if (prevMsg) {
		// The message sender is the same, check if the messages are sent close enough to each other
		const currTime = moment(msg.created_at);
		const maxTime = moment(prevMsg.created_at).add(2, 'm');

		if (currTime.isAfter(maxTime))
			// The message was sent after grouping deadline, start a new sender group
			group.push([]);
	}

	// Add messsage to latest group
	group.at(-1)?.push(msg);
}

/** Group a list of messages */
function groupAllMessages(messages: ExpandedMessageWithPing[]): GroupedMessages {
	// Group by day
	const groupedByDay = groupBy(messages, (msg) => moment(msg.created_at).startOf('day').format());

	const grouped: GroupedMessages = {};
	for (const [group, msgs] of Object.entries(groupedByDay)) {
		const localGrouped: ExpandedMessageWithPing[][] = [[msgs[0]]];

		// Group all messages within this day group into sender groups
		for (let i = 1; i < msgs.length; ++i)
			addMessageToDayGroup(localGrouped, msgs[i]);

		// Add sender gouped messages
		grouped[group] = localGrouped;
	}

	return grouped;
}

/** Message fetcher */
function fetcher(session: SessionState, reader: MemberWrapper<false>, env: MarkdownEnv | undefined) {
	return async (key: string) => {	
		// Domain and member should be loaded by the time the fetcher is called
		assert(env && reader._exists);

		const channel_id = key.split('.')[0];
		const page = parseInt(key.split('=').at(-1) as string);

		// Get messages, sorted by creation time
		const results = await query<Message[]>(
			sql.select<Message>('*', {
				from: 'messages',
				where: sql.match({ channel: channel_id }),
				sort: [{ field: 'created_at', order: 'DESC' }],
				limit: config.app.message.query_limit,
				start: page * config.app.message.query_limit,
			}),
			{ session }
		);
		if (!results?.length) return [];
		

		// Messages are an array ordered newest first. To make appending messages easy, reverse page order
		// so that new messages are appended
		const messages = results.reverse();

		// Get set of senders and determine if each message has a ping aimed at user
		const senders: Record<string, Member | null> = {};
		const hasPing: boolean[] = [];
		// Map of messages for quick lookup
		const messageMap: Record<string, Message> = {};

		for (const msg of messages) {
			if (msg.sender)
				senders[msg.sender] = null;

			// Analyze message for pings
			const mentions = findMentions(msg.message);
			
			let ping = mentions.members.has(reader.id);
			if (reader.roles) {
				for (let i = 0; !ping && i < reader.roles.length; ++i)
					ping = mentions.roles.has(reader.roles[i]);
			}
			hasPing.push(ping);

			// Add member pings to senders list to get fetched
			mentions.members.forEach(m => senders[m] = null);

			// Add message to map for fast lookup
			messageMap[msg.id] = msg;
		}

		// Get members data
		const members = await getMembers(env.domain.id, Object.keys(senders), session);
		for (const member of members)
			senders[member.id] = member;

		// Render messages, attach senders and pings to message
		const expanded: ExpandedMessageWithPing[] = messages.map((msg, i) => {
			// Modify object in place
			const expandedMsg = msg as ExpandedMessageWithPing;
			expandedMsg.message = renderMessage(msg.id, msg.message, env);
			expandedMsg.sender = msg.sender ? senders[msg.sender] : null;
			expandedMsg.pinged = hasPing[i];
			expandedMsg.reply_to = msg.reply_to ? messageMap[msg.reply_to] as ExpandedMessage : undefined;

			return expandedMsg;
		});

		// Return expanded messages
		return expanded;
	};
}


////////////////////////////////////////////////////////////
function addMessageLocal(messages: ExpandedMessageWithPing[][] | undefined, message: Message, reader: Member, env: MarkdownEnv) {
	const domain_id = env.domain.id;

	// Don't add message if env does not exist. If env does not exist, then the channel's messages
	// have not been loaded, and adding the message locally would be redundant because an initial load
	// would still be needed when user first views channel
	if (!env) return messages;

	// Check if reader is pinged
	const { pinged } = hasPings(message.message, reader);

	// Find reply to if it exist
	let reply_to: ExpandedMessage | undefined = undefined;
	if (messages && message.reply_to) {
		// Find message this one is replying to
		const { page, idx } = findMessage(messages, message.reply_to);
		if (idx >= 0)
			reply_to = messages[page][idx];
	}

	// Render message
	const rendered: ExpandedMessageWithPing = {
		...message,
		message: renderMessage(message.id, message.message, env),
		sender: message.sender ? getMemberSync(domain_id, message.sender) : null,
		pinged,
		reply_to,
	};

	// Return message list with appended message
	const last = messages?.length ? messages[messages.length - 1] : [];
	return [...(messages?.slice(0, -1) || []), [...last, rendered]];
}

////////////////////////////////////////////////////////////
function editMessageLocal(messages: ExpandedMessageWithPing[][] | undefined, message_id: string, message: string, reader: Member, env: MarkdownEnv) {
	if (!messages) return undefined;
	assert(env);

	// Check if reader is pinged
	const { pinged } = hasPings(message, reader);

	// Find message
	const { page, idx } = findMessage(messages, message_id);
	if (idx < 0) return messages;

	// Create copies
	const pagesCopy = messages.slice();
	const msgsCopy = pagesCopy[page].slice();
	msgsCopy[idx] = {
		...msgsCopy[idx],
		message: renderMessage(message_id, message, env),
		pinged,
		edited: true,
	};
	pagesCopy[page] = msgsCopy;

	return pagesCopy;
}

////////////////////////////////////////////////////////////
function deleteMessageLocal(messages: ExpandedMessageWithPing[][] | undefined, message_id: string) {
	if (!messages) return undefined;

	// Find message
	const { page, idx } = findMessage(messages, message_id);
	if (idx < 0) return messages;

	// Create copies
	const pagesCopy = messages.slice();
	const msgsCopy = pagesCopy[page].slice();
	msgsCopy.splice(idx, 1);
	pagesCopy[page] = msgsCopy;

	return pagesCopy;
}


////////////////////////////////////////////////////////////
function mutators(mutate: KeyedMutator<ExpandedMessageWithPing[][]>, session: SessionState, channel_id: string, reader: Member, env: MarkdownEnv | undefined) {
	assert(env);

	return {
		/**
		 * Add a message to the specified channel
		 * 
		 * @param message The message to post to the channel
		 * @param sender The id of the sender profile
		 * @param options.attachments A list of attachments that are attached to message
		 * @param options.reply_to The message this one is replying to
		 * @returns The new grouped messages object
		 */
		addMessage: (message: string, sender: Member, options?: { attachments?: FileAttachment[]; reply_to?: ExpandedMessage; }) => {
			// Generate temporary id so we know which message to update with correct id
			const tempId = uuid();
			// Time message is sent
			const now = new Date().toISOString();

			return mutate(swrErrorWrapper(async (messages: ExpandedMessageWithPing[][]) => {
				const domain_id = env.domain.id;
				const hasAttachments = domain_id && options?.attachments && options.attachments.length > 0;

				// Post all attachments
				const uploads = hasAttachments ? await uploadAttachments(domain_id, options?.attachments || [], session) : [];

				// Post message
				const results = await query<Message[]>(
					sql.create<Message>('messages', {
						channel: channel_id,
						sender: sender.id,
						reply_to: options?.reply_to?.id,
						message,
						attachments: hasAttachments ? uploads : undefined,
						created_at: now,
					}),
					{ session }
				);
				assert(results);

				// Send event to realtime server
				socket().emit('chat:message', results[0]);

				// Update message with the correct id
				return addMessageLocal(messages, results[0], sender, env);
			}, { message: 'An error occurred while posting message' }), {
				optimisticData: (messages) => {
					// Add message locally with temp id
					return addMessageLocal(messages, {
						id: tempId,
						channel: channel_id,
						sender: sender.id,
						message,
						attachments: options?.attachments?.map(f => ({
							...f,
							filename: f.file.name,
							url: f.type === 'image' ? URL.createObjectURL(f.file) : '',
							file: undefined,
						})),
						created_at: now,
					}, sender, env) || [];
				},
				revalidate: false,
			});
		},

		/**
		 * Add a message locally. This message will not be posted to the database.
		 * This should be used to display messages received through websockets.
		 * 
		 * @param message The message to add
		 * @param reader The member that is viewing the messages (used to highlight member pings)
		 * @returns The new grouped messages
		 */
		addMessageLocal: (message: Message) => mutate(
			swrErrorWrapper(
				async (messages: ExpandedMessageWithPing[][]) => {
					// Load sender if needed
					const domain_id = env.domain.id;
					if (session && message.sender && domain_id)
						await getMember(domain_id, message.sender, session);
						
					return addMessageLocal(messages, message, reader, env);
				},
				{ message: 'An error occurred while displaying a message' }
			),
			{ revalidate: false }
		),

		/**
		 * Edit a message (only the text parts)
		 * 
		 * @param message_id The id of the message to edit
		 * @param message The new message text to set
		 * @returns The new message pages
		 */
		editMessage: (message_id: string, message: string) => mutate(
			swrErrorWrapper(
				async (messages: ExpandedMessageWithPing[][]) => {
					// Send update query
					const results = await query<Message[]>(
						sql.update<Message>(message_id, {
							set: {
								message,
								edited: true,
							},
							return: ['message'],
						}),
						{ session }
					);
					assert(results && results.length > 0);

					// Update message locally
					return editMessageLocal(messages, message_id, message, reader, env);
				},
				{ message: 'An error occurred while editing message' }
			),
			{
				optimisticData: (messages) => {
					// Add message locally with temp id
					return editMessageLocal(
						messages,
						message_id,
						message,
						reader,
						env
					) || [];
				},
				revalidate: false,
			}
		),

		/**
		 * Delete a message
		 * 
		 * @param message_id The id of the message to delete 
		 * @returns The new message pages
		 */
		deleteMessage: (message_id: string) => mutate(
			swrErrorWrapper(
				async (messages: ExpandedMessageWithPing[][]) => {
					assert(message_id.startsWith('messages:'));

					// Send delete query
					await query<Message[]>(sql.delete(message_id), { session });

					// Update message locally
					return deleteMessageLocal(messages, message_id);
				},
				{ message: 'An error occurred while deleting message' }
			),
			{
				optimisticData: (messages) => {
					return deleteMessageLocal(messages, message_id) || [];
				},
				revalidate: false,
			}
		),
	};
}


/** Mutators that will be attached to the grouped messages swr wrapper */
export type MessageMutators = ReturnType<typeof mutators>;
/** Swr data wrapper for grouped messages */
export type MessagesWrapper<Loaded extends boolean = true> = SwrWrapper<GroupedMessages, Loaded, MessageMutators, true, true>;


/**
 * Retrieve messages for the specified channel.
 * Messages returned from this hook are grouped by day and time proximity/sender.
 * All messages are fully rendered to html.
 * 
 * @param channel_id The id of the channel to retrieve messages from
 * @param domain The domain the channel belongs to (used to correctly render mentions, emotes, etc.)
 * @param reader The member that is viewing the messages (used to highlight member pings)
 * @returns A list of messages sorted oldest first
 */
export function useMessages(channel_id: string, domain: DomainWrapper<false>, reader: MemberWrapper<false>) {
	const session = useSession();

	// Env object for markdown rendering
	const env = useMemo<MarkdownEnv | undefined>(() => {
		if (!domain._exists) return;

		// Construct roles map
		const roleMap: Record<string, Role> = {};
		for (const r of (domain.roles || []))
			roleMap[r.id] = r;

		return {
			domain: { id: domain.id, roles: roleMap }
		};
	}, [domain.id, domain.roles]);

	// Infinite loader
	const swr = useSWRInfinite<ExpandedMessageWithPing[]>(
		(idx, prevData: ExpandedMessageWithPing[]) => {
			// Don't retrieve if reached end
			if (prevData && prevData.length < config.app.message.query_limit) return;
			if (!session.token || !domain._exists || !reader._exists || !env || !channel_id) return;

			// Return key with page number
			return `${channel_id}.messages?page=${idx}`;
		},
		fetcher(session, reader, env),
		{ revalidateFirstPage: false }
	);

	// Wrapper
	const wrapper = useSwrWrapper<ExpandedMessageWithPing[], MessageMutators, true, GroupedMessages, true>(swr, {
		transform: (messages) => {
			// Flatten array
			let flattened: ExpandedMessageWithPing[] = [];
			for (let p = messages.length - 1; p >= 0; --p)
				flattened = flattened.concat(messages[p]);

			// Group messages
			return groupAllMessages(flattened);
		},
		pageSize: config.app.message.query_limit,
		mutators,
		mutatorParams: [channel_id, reader, env],
		separate: true,
		session,
	});
	return wrapper;
}