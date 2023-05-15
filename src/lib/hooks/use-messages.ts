import assert from 'assert';

import useSWR, { KeyedMutator } from 'swr';

import config from '@/config';
import { AttachmentInfo, uploadAttachment } from '@/lib/api';
import { SessionState } from '@/lib/contexts';
import { getMember, getMemberSync, getMembers, query, sql } from '@/lib/db';
import { Channel, Domain, ExpandedDomain, ExpandedMessage, Member, Message, Role } from '@/lib/types';

import { MemberWrapper } from './use-members';
import { useSession } from './use-session';

import { SyncCache } from '@/lib/utility/cache';
import { swrErrorWrapper } from '@/lib/utility/error-handler';
import { SwrWrapper, wrapSwrData } from '@/lib/utility/swr-wrapper';

import hljs from 'highlight.js';
import { groupBy } from 'lodash';
import MarkdownIt from 'markdown-it';
import moment from 'moment';
import shash from 'string-hash';

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
			return `<span class="avid-highlight avid-mention-member">@${alias}</span>`;
		}

		md.renderer.rules.mention_role = (tokens, idx, opts, env: MarkdownEnv) => {
			const id = `roles:${tokens[idx].content}`;
			const role = env.domain?.roles?.[id];
			const name = role?.label || '_';
			const color = role?.color || '#EAECEF';
			return `<span class="avid-highlight" style="background-color: ${color}2A; color: ${color}; font-weight: 600;">@${name}</span>`;
		}
	});


/** Shared mutable state */
const _state = {
	/** Counter for generating ids */
	counter: 0,
	/** Message cache */
	msg_cache: {} as Record<string, { hash: number, rendered: string }>,
	/** Env cache */
	env_cache: new SyncCache<MarkdownEnv>(),
	/** Channel to domain map */
	channel_to_domain: {} as Record<string, string>,
};


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
	
/** Render a single message */
function renderMessage(id: string, message: string, env: MarkdownEnv) {
	// Keep only random part of message id
	id = id.split(':').at(-1) || '';
	assert(id);

	// Generate hash of new message
	const hash = shash(message);

	// Return cached value if it exists and hasn't changed
	if (_state.msg_cache[id] && _state.msg_cache[id].hash === hash)
		return _state.msg_cache[id].rendered;

	// Render new message
	const rendered = _md.render(message, env);

	// Add to cache
	_state.msg_cache[id] = { hash, rendered };

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
function groupAllMessages(messages: ExpandedMessageWithPing[], env: MarkdownEnv): GroupedMessages {
	// Render messages
	const rendered = messages.map(msg => ({ ...msg, message: renderMessage(msg.id, msg.message, env) }));

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

/** Message fetcher */
function fetcher(session: SessionState, reader: MemberWrapper<false>) {
	return async (key: string) => {
		// Member should be loaded by the time the fetcher is called
		assert(reader._exists);

		const channel_id = key.split('.')[0];

		// Get markdown env if cached
		let env = null;
		{
			const domain_id = _state.channel_to_domain[channel_id];
			env = domain_id && _state.env_cache.isValid(domain_id) ? _state.env_cache.get(domain_id) : null;
		}
		
		// Construct db query statements
		const statements = [
			sql.select<Message>('*', {
				from: 'messages',
				where: sql.match({ channel: channel_id }),
				sort: 'created_at',
				limit: config.app.message.query_limit,
			}),
		];
		// Retrieve domain data if markdown env not cached
		if (!env)
			statements.push(sql.select<Channel>(['domain.id', 'domain.roles'], { from: channel_id, fetch: ['domain.roles'] }));

		// Get messages, sorted by creation time
		const results = await query<[Message[], { domain: ExpandedDomain }[]]>(
			sql.multi(statements),
			{ session, complete: true }
		);
		if (!results) return null;

		// Construct markdown env
		if (!env) {
			const domain = results[1][0].domain;

			// Construct roles map
			const roleMap: Record<string, Role> = {};
			for (const r of (domain.roles || []))
				roleMap[r.id] = r;

			// Create env object
			env = {
				domain: { id: domain.id, roles: roleMap },
			};

			// Cache env
			_state.env_cache.add(domain.id, env);
			_state.channel_to_domain[channel_id] = domain.id;
		}

		const messages = results[0];

		// Get set of senders and determine if each message has a ping aimed at user
		const senders: Record<string, Member | null> = {};
		const hasPing: boolean[] = [];

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
		}

		// Get members
		const members = await getMembers(env.domain.id, Object.keys(senders), session);
		for (const member of members)
			senders[member.id] = member;

		// Attach senders and pings to message
		const expanded: ExpandedMessageWithPing[] = messages.map((msg, i) => ({
			...msg,
			sender: msg.sender ? senders[msg.sender] : null,
			pinged: hasPing[i],
		}));

		// Return grouped messages
		return groupAllMessages(expanded, env);
	};
}


////////////////////////////////////////////////////////////
function addMessageLocal(messages: GroupedMessages, message: Message, reader: Member) {
	// Get markdown env if cached
	const domain_id = _state.channel_to_domain[message.channel];
	let env = domain_id ? _state.env_cache.get(domain_id) : null;

	// Don't add message if env does not exist. If env does not exist, then the channel's messages
	// have not been loaded, and adding the message locally would be redundant because an initial load
	// would still be needed when user first views channel
	if (!env) return messages;

	// Analyze message for mentions
	const mentions = findMentions(message.message);

	let pinged = mentions.members.has(reader.id);
	if (reader.roles) {
		for (let i = 0; !pinged && i < reader.roles.length; ++i)
			pinged = mentions.roles.has(reader.roles[i]);
	}

	// Render message
	const rendered: ExpandedMessageWithPing = {
		...message,
		message: renderMessage(message.id, message.message, env),
		sender: message.sender ? getMemberSync(domain_id, message.sender) : null,
		pinged,
	};

	// Get message day group
	const dayGroup = moment(message.created_at).startOf('day').format();

	// Create group array
	const group = [...(messages[dayGroup] || [])];
	if (messages[dayGroup]) {
		// If day group didn't exist, make copy of last sender group in case the new message will be added to it
		group[group.length - 1] = group[group.length - 1].slice();

		addMessageToDayGroup(group, rendered);
	}
	else
		// Simple way to add new message
		group.push([rendered]);

	return { ...messages, [dayGroup]: group };
}


////////////////////////////////////////////////////////////
function mutatorFactory(mutate: KeyedMutator<GroupedMessages>, session?: SessionState) {
	assert(session);

	return {
		/**
		 * Add a message to the specified channel
		 * 
		 * @param channel_id The id of the channel to add a message to
		 * @param message The message to post to the channel
		 * @param sender The id of the sender profile
		 * @param attachments A list of attachments that are attached to message
		 * @returns The new grouped messages object
		 */
		addMessage: (channel_id: string, message: string, sender: Member, attachments?: File[]) => {
			// Generate temporary id so we know which message to update with correct id
			const tempId = (_state.counter++).toString();
			// Time message is sent
			const now = new Date().toISOString();

			// TODO : change local globals to globals hook

			return mutate(swrErrorWrapper(async (messages: GroupedMessages) => {
				const domain_id = _state.channel_to_domain[channel_id]
				const hasAttachments = domain_id && attachments && attachments.length > 0;

				// Post all attachments
				const promises: Promise<AttachmentInfo>[] = [];
				if (hasAttachments && domain_id) {
					for (const file of attachments)
						promises.push(uploadAttachment(domain_id, file, session));
				}

				// Await all uploads
				const uploads: AttachmentInfo[] = [];
				for (const promise of promises)
					uploads.push(await promise);

				// Post message
				const results = await query<Message[]>(
					sql.create<Message>('messages', {
						channel: channel_id,
						sender: sender.id,
						message,
						attachments: hasAttachments ? attachments.map((f, i) => ({
							type: f.type.startsWith('image') ? 'image' : 'file',
							filename: f.name,
							...uploads[i],
						})) : undefined,
						created_at: now,
					}),
					{ session }
				);
				assert(results);

				// Update message with the correct id
				return addMessageLocal(messages, results[0], sender);
			}, { message: 'An error occurred while posting message' }), {
				optimisticData: (messages) => {
					// Add message locally with temp id
					return addMessageLocal(messages || {}, {
						id: tempId,
						channel: channel_id,
						sender: sender.id,
						message,
						attachments: attachments?.map(f => ({
							type: f.type.startsWith('image') ? 'image' : 'file',
							filename: f.name,
							url: f.type.startsWith('image') ? URL.createObjectURL(f) : '',
						})),
						created_at: now,
					}, sender);
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
		addMessageLocal: (message: Message, reader: Member) => mutate(
			swrErrorWrapper(
				async (messages) => {
					// Load sender if needed
					const domain_id = _state.channel_to_domain[message.channel];
					if (session && message.sender && domain_id)
						await getMember(domain_id, message.sender, session);
						
					return addMessageLocal(messages || {}, message, reader);
				},
				{ message: 'An error occurred while displaying a message' }
			),
			{ revalidate: false }
		),
	};
}


/** Mutators that will be attached to the grouped messages swr wrapper */
export type MessageMutators = ReturnType<typeof mutatorFactory>;
/** Swr data wrapper for grouped messages */
export type MessagesWrapper<Loaded extends boolean = true> = SwrWrapper<GroupedMessages, MessageMutators, true, Loaded>;


/**
 * Retrieve messages for the specified channel.
 * Messages returned from this hook are grouped by day and time proximity/sender.
 * All messages are fully rendered to html.
 * 
 * @param channel_id The id of the channel to retrieve messages from
 * @param reader The member that is viewing the messages (used to highlight member pings)
 * @returns A list of messages sorted oldest first
 */
export function useMessages(channel_id: string, reader: MemberWrapper<false>) {
	const session = useSession()

	const swr = useSWR<GroupedMessages | null>(
		reader._exists && channel_id && session.token ? `${channel_id}.messages` : null,
		fetcher(session, reader)
	);

	return wrapSwrData<GroupedMessages, MessageMutators, true>(swr, mutatorFactory, true, session);
}