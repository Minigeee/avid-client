import { useMemo } from 'react';
import ReactDomServer from 'react-dom/server';
import assert from 'assert';

import useSWR, { KeyedMutator, mutate as _mutate } from 'swr';
import useSWRInfinite from 'swr/infinite';
import { cache, ScopedMutator, useSWRConfig } from 'swr/_internal';

import config from '@/config';
import { api, uploadAttachments } from '@/lib/api';
import { SessionState } from '@/lib/contexts';
import { ExpandedMessage, FileAttachment, Member, Message, Reaction, Role } from '@/lib/types';

import { DomainWrapper } from './use-domain';
import { MemberWrapper, getMemberSync, setMembers, useMemberCache } from './use-members';
import { useSession } from './use-session';
import { SwrWrapper, useSwrWrapper } from './use-swr-wrapper';

import { Emoji, emojiSearch } from '@/lib/ui/components/Emoji';
import { swrErrorWrapper } from '@/lib/utility/error-handler';

import hljs from 'highlight.js';
import { groupBy } from 'lodash';
import MarkdownIt from 'markdown-it';
import moment from 'moment';
import shash from 'string-hash';
import { v4 as uuid } from 'uuid';

import sanitizeHtml from 'sanitize-html';
import StateCore from 'markdown-it/lib/rules_core/state_core';
import Token from 'markdown-it/lib/token';
import emojiRegex from 'emoji-regex';


/** Message recieved from api */
export type RawMessage = Message & { reactions?: Reaction[] };

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


const _emojiRegex = emojiRegex();

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
	.use((md: MarkdownIt, options: any) => {
		// Renderer
		md.renderer.rules.emoji = function (token, idx) {
			const native = token[idx].content;
			return native;
		};

		function create_rule(md: MarkdownIt, scanRE: RegExp, replaceRE: RegExp) {
			var arrayReplaceAt = md.utils.arrayReplaceAt,
				// @ts-ignore
				ucm = md.utils.lib.ucmicro,
				ZPCc = new RegExp([ucm.Z.source, ucm.P.source, ucm.Cc.source].join('|'));

			function splitTextToken(text: string, level: number, Token: StateCore['Token']) {
				var token, last_pos = 0, nodes = [];

				// @ts-ignore
				text.replace(replaceRE, function (match, offset, src) {
					var emoji_name = match.slice(1, -1);

					// Get emoji
					const emoji = emojiSearch.get(emoji_name);
					if (!emoji || emoji.skins.length === 0) return;

					// Add new tokens to pending list
					if (offset > last_pos) {
						token = new Token('text', '', 0);
						token.content = text.slice(last_pos, offset);
						nodes.push(token);
					}

					token = new Token('emoji', '', 0);
					token.markup = emoji_name;
					token.content = emoji.skins[0].native;
					nodes.push(token);

					last_pos = offset + match.length;
				});

				if (last_pos < text.length) {
					token = new Token('text', '', 0);
					token.content = text.slice(last_pos);
					nodes.push(token);
				}

				return nodes;
			}

			return function emoji_replace(state: StateCore) {
				var i, j, l, tokens: Token[], token,
					blockTokens = state.tokens,
					autolinkLevel = 0;

				for (j = 0, l = blockTokens.length; j < l; j++) {
					if (blockTokens[j].type !== 'inline') { continue; }
					tokens = blockTokens[j].children || [];

					// We scan from the end, to keep position when new tags added.
					// Use reversed logic in links start/end match
					for (i = tokens.length - 1; i >= 0; i--) {
						token = tokens[i];

						if (token.type === 'link_open' || token.type === 'link_close') {
							if (token.info === 'auto') { autolinkLevel -= token.nesting; }
						}

						if (token.type === 'text' && autolinkLevel === 0 && scanRE.test(token.content)) {
							// replace current node
							blockTokens[j].children = tokens = arrayReplaceAt(
								tokens, i, splitTextToken(token.content, token.level, state.Token)
							);
						}
					}
				}
			};
		};

		md.core.ruler.after(
			'linkify',
			'emoji',
			create_rule(md, /:\w+:/, /:\w+:/g)
		);

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
			// const badge = role?.badge ? ReactDomServer.renderToStaticMarkup(<Emoji id={role.badge} />) : null;
			return `<span class="avid-highlight avid-mention-role" data-type="pingMention" data-id="${id}" data-variant="role" data-label="${name}" >@${name}</span>`;
		}
	});


/** Caches */
let _cache = {
	message: {} as Record<string, {
		hash: number;
		rendered: string;
		has_ping: boolean;
	}>,
}


////////////////////////////////////////////////////////////
// Message fetcher
////////////////////////////////////////////////////////////

/** Message fetcher */
function fetcher(session: SessionState, domain_id: string) {
	return async (key: string) => {
		const channel_id = key.split('.')[0];
		const page = parseInt(key.split('=').at(-1) as string);

		const results = await api('GET /messages', {
			query: { channel: channel_id, page, limit: config.app.message.query_limit },
		}, { session });

		// Set members
		console.log('fetch msg')
		setMembers(domain_id, Object.values(results.members), false);

		// Messages are an array ordered newest first. To make appending messages easy, reverse page order
		// so that new messages are appended
		return results.messages.reverse();
	};
}

/** Find message within pages */
function findMessage(messages: RawMessage[][], message_id: string) {
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

////////////////////////////////////////////////////////////
function addMessageLocal(messages: RawMessage[][] | undefined, message: Message): RawMessage[][] | undefined {
	// Return message list with appended message
	const last = messages?.length ? messages[messages.length - 1] : [];
	return [...(messages?.slice(0, -1) || []), [...last, message]];
}

////////////////////////////////////////////////////////////
function editMessageLocal(messages: RawMessage[][] | undefined, message_id: string, message: string) {
	if (!messages) return undefined;

	// Find message
	const { page, idx } = findMessage(messages, message_id);
	if (idx < 0) return messages;

	// Create copies
	const pagesCopy = messages.slice();
	const msgsCopy = pagesCopy[page].slice();
	msgsCopy[idx] = {
		...msgsCopy[idx],
		message,
		edited: true,
	};
	pagesCopy[page] = msgsCopy;

	return pagesCopy;
}

////////////////////////////////////////////////////////////
function deleteMessageLocal(messages: RawMessage[][] | undefined, message_id: string) {
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
function mutators(mutate: KeyedMutator<RawMessage[][]>, session: SessionState, channel_id: string, domain_id: string) {
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

			return mutate(swrErrorWrapper(async (messages: RawMessage[][]) => {
				const hasAttachments = domain_id && options?.attachments && options.attachments.length > 0;

				// Post all attachments
				const uploads = hasAttachments ? await uploadAttachments(domain_id, options?.attachments || [], session) : [];

				// Post message
				const results = await api('POST /messages', {
					body: {
						channel: channel_id,
						reply_to: options?.reply_to?.id,
						message,
						attachments: hasAttachments ? uploads : undefined,
					},
				}, { session });

				// Update message with the correct id
				return addMessageLocal(messages, results);
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
					}) || [];
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
				async (messages: RawMessage[][]) => {
					return addMessageLocal(messages, message);
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
				async (messages: RawMessage[][]) => {
					// Send update query
					const results = await api('PATCH /messages/:message_id', {
						params: { message_id },
						body: { message },
					}, { session });

					// Update message locally
					return editMessageLocal(messages, message_id, results.message);
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
				async (messages: RawMessage[][]) => {
					// Send delete query
					await api('DELETE /messages/:message_id', { params: { message_id } }, { session });

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
export type MessagesWrapper<Loaded extends boolean = true> = SwrWrapper<RawMessage[], Loaded, MessageMutators, true, true>;


/**
 * Retrieve messages for the specified channel.
 * Messages returned from this hook are grouped by day and time proximity/sender.
 * All messages are fully rendered to html.
 * 
 * @param channel_id The id of the channel to retrieve messages from
 * @param domain_id The domain the channel belongs to (used to cache member objects)
 * @returns A list of messages sorted oldest first
 */
export function useMessages(channel_id: string, domain_id: string) {
	const session = useSession();

	// Infinite loader
	const swr = useSWRInfinite<RawMessage[]>(
		(idx, prevData: RawMessage[]) => {
			// Don't retrieve if reached end
			if (prevData && prevData.length < config.app.message.query_limit) return;
			if (!session.token || !channel_id) return;

			// Return key with page number
			return `${channel_id}.messages?page=${idx}`;
		},
		fetcher(session, domain_id),
		{ revalidateFirstPage: false }
	);

	// Wrapper
	const wrapper = useSwrWrapper<RawMessage[], MessageMutators, true, RawMessage[], true>(swr, {
		transform: (messages) => {
			// Flatten array
			let flattened: RawMessage[] = [];
			for (let p = messages.length - 1; p >= 0; --p)
				flattened = flattened.concat(messages[p]);

			return flattened;
		},
		pageSize: config.app.message.query_limit,
		mutators,
		mutatorParams: [channel_id, domain_id],
		separate: true,
		session,
	});
	return wrapper;
}



////////////////////////////////////////////////////////////
// Message grouper + renderer
////////////////////////////////////////////////////////////

/** Render a single message */
function renderMessage(message: string, env: MarkdownEnv) {
	// Render new message
	let rendered = _md.render(message, env);

	// Native emojis
	rendered = rendered.replaceAll(_emojiRegex, (match) => {
		const emoji = emojiSearch.get(match);
		return emoji ? `<span class="emoji" data-type="emojis" emoji-id="${emoji.id}" data-emoji-set="native">${match}</span>` : match;
	});

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
function groupAllMessages(messages: RawMessage[], reader: MemberWrapper, env: MarkdownEnv): GroupedMessages {
	const rendered: ExpandedMessageWithPing[] = [];

	// Map of message to index, for reply to
	const messageMap: Record<string, number> = {};
	// List of messages with reply tos
	const msgsWithReply: ExpandedMessageWithPing[] = [];

	// Render message
	for (let i = 0; i < messages.length; ++i) {
		const msg = messages[i];
		// Check if message changed
		const hash = shash(msg.message);

		// Return cached value if it exists and hasn't changed
		let cached = _cache.message[msg.id];
		if (!cached || cached.hash !== hash) {
			// Render and process message
			const mentions = {
				members: new Set(msg.mentions?.members),
				roles: new Set(msg.mentions?.roles),
			};

			// Check if message has ping for reader
			let ping = mentions.members.has(reader.id);
			if (reader.roles) {
				for (let i = 0; !ping && i < reader.roles.length; ++i)
					ping = ping || mentions.roles.has(reader.roles[i]);
			}

			// Check if all mentioned members are loaded, don't save hash if all aren't loaded
			let membersLoaded = true;
			for (const id of msg.mentions?.members || [])
				membersLoaded = membersLoaded && getMemberSync(env.domain.id, id) !== null;

			// Save to cache
			cached = {
				hash: membersLoaded ? hash : 0,
				rendered: renderMessage(msg.message, env),
				has_ping: ping,
			};
			_cache.message[msg.id] = cached;
		}

		// Add to mapping
		messageMap[msg.id] = i;

		// Add to rendered list
		const renderedMsg = {
			...msg,
			message: cached.rendered,
			sender: msg.sender ? getMemberSync(env.domain.id, msg.sender) : null,
			pinged: cached.has_ping,
		} as ExpandedMessageWithPing;
		rendered.push(renderedMsg);

		// Add to reply tos
		if (msg.reply_to)
			msgsWithReply.push(renderedMsg);
	}

	// Link reply tos
	for (const msg of msgsWithReply)
		msg.reply_to = rendered[messageMap[msg.reply_to as unknown as string]];

	// Group by day
	const groupedByDay = groupBy(rendered, (msg) => moment(msg.created_at).startOf('day').format());

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


/**
 * Renders and groups a list of raw messages
 * 
 * @param messages The list of raw messages
 * @param domain The domain the channel belongs to (used to correctly render mentions, emotes, etc.)
 * @param reader The member that is viewing the messages (used to highlight member pings)
 * @returns The messages rendered and grouped
 */
export function useGroupedMessages(messages: RawMessage[], domain: DomainWrapper<false>, reader: MemberWrapper<false>) {
	const members = useMemberCache();

	// Create md render env
	const env = useMemo<MarkdownEnv | undefined>(() => {
		if (!domain._exists) return;

		// Construct roles map
		const roleMap: Record<string, Role> = {};
		for (const r of (domain.roles || []))
			roleMap[r.id] = r;

		return {
			domain: { id: domain.id, roles: roleMap },
		};
	}, [domain.id, domain.roles]);

	return useMemo(() => {
		// console.log(messages, members, reader._exists, env)
		if (!reader._exists || !env) return;
		return groupAllMessages(messages, reader, env);
	}, [messages, members, reader._exists, env]);
}