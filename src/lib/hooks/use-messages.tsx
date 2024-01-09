import { useCallback, useMemo } from 'react';
import ReactDomServer from 'react-dom/server';
import assert from 'assert';

import useSWR, { KeyedMutator, mutate as _mutate } from 'swr';
import useSWRInfinite, { unstable_serialize } from 'swr/infinite';

import config from '@/config';
import { api, uploadAttachments } from '@/lib/api';
import { SessionState } from '@/lib/contexts';
import {
  AggregatedReaction,
  ExpandedMessage,
  ExpandedPrivateMember,
  FileAttachment,
  Member,
  Message,
  PrivateMember,
  Profile,
  RawMessage,
  Role,
  Thread,
} from '@/lib/types';

import { DomainWrapper } from './use-domain';
import {
  MemberWrapper,
  getMemberSync,
  setMembers,
  useMemberCache,
} from './use-members';
import { useSession } from './use-session';
import { SwrWrapper, useSwrWrapper } from './use-swr-wrapper';
import { getThreadSync, setThreads, useThreadCache } from './use-threads';

import { emojiSearch, renderNativeEmojis } from '@/lib/utility/emoji';
import { errorWrapper, swrErrorWrapper } from '@/lib/utility/error-handler';

import hljs from 'highlight.js';
import { groupBy } from 'lodash';
import MarkdownIt from 'markdown-it';
import moment from 'moment';
import shash from 'string-hash';
import { v4 as uuid } from 'uuid';

import sanitizeHtml from 'sanitize-html';
import StateCore from 'markdown-it/lib/rules_core/state_core';
import Token from 'markdown-it/lib/token';

/** An expanded message with information on if a target member was pinged within message */
export type ExpandedMessageWithPing = ExpandedMessage & {
  /** Determines if the target member was pinged */
  pinged: boolean;
};

/** Type for grouped messages within a channel. It is grouped by day, then by sender */
export type GroupedMessages = Record<string, ExpandedMessageWithPing[][]>;

/** Type for stripped down member object, to only fields that are needed */
type MinMember = {
  _exists?: boolean;
  id?: string;
  roles?: string[];
};

/** Key function for infinite loader */
type _KeyFn = (idx: number, prevData: RawMessage[]) => string;

////////////////////////////////////////////////////////////
type MarkdownEnv = {
  domain?: {
    id: string;
    roles?: Record<string, Role>;
  };
  /** Members in a private channel */
  members?: Record<string, ExpandedPrivateMember>;
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
      } catch (__) {}
    }

    return ''; // use external default escaping
  },
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
        ZPCc = new RegExp(
          [ucm.Z.source, ucm.P.source, ucm.Cc.source].join('|'),
        );

      function splitTextToken(
        text: string,
        level: number,
        Token: StateCore['Token'],
      ) {
        var token,
          last_pos = 0,
          nodes = [];

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
        var i,
          j,
          l,
          tokens: Token[],
          token,
          blockTokens = state.tokens,
          autolinkLevel = 0;

        for (j = 0, l = blockTokens.length; j < l; j++) {
          if (blockTokens[j].type !== 'inline') {
            continue;
          }
          tokens = blockTokens[j].children || [];

          // We scan from the end, to keep position when new tags added.
          // Use reversed logic in links start/end match
          for (i = tokens.length - 1; i >= 0; i--) {
            token = tokens[i];

            if (token.type === 'link_open' || token.type === 'link_close') {
              if (token.info === 'auto') {
                autolinkLevel -= token.nesting;
              }
            }

            if (
              token.type === 'text' &&
              autolinkLevel === 0 &&
              scanRE.test(token.content)
            ) {
              // replace current node
              blockTokens[j].children = tokens = arrayReplaceAt(
                tokens,
                i,
                splitTextToken(token.content, token.level, state.Token),
              );
            }
          }
        }
      };
    }

    md.core.ruler.after('linkify', 'emoji', create_rule(md, /:\w+:/, /:\w+:/g));
  })
  .use((md) => {
    md.inline.ruler.after('emphasis', 'mentions', (state, silent) => {
      var found,
        content,
        token,
        max = state.posMax,
        start = state.pos;

      if (state.src.at(start) !== '@') {
        return false;
      }

      const mtype = config.app.message.member_mention_chars;
      const rtype = config.app.message.role_mention_chars;

      // Mention type
      let type = state.src.at(start + 1);
      if (type === mtype[0]) type = mtype[1];
      else if (type === rtype[0]) type = rtype[1];
      else return false;

      // Make sure all valid characters
      let i = 0;
      for (; i < config.app.message.max_mention_length; ++i) {
        const idx = start + 2 + i;
        const c = state.src.charCodeAt(idx);

        if (
          c < 48 ||
          (c > 57 && c < 65) ||
          (c > 90 && c < 97 && c !== 95) ||
          c > 122
        ) {
          if (state.src.at(idx) === type) break;
          else return false;
        }
      }
      if (i === config.app.message.max_mention_length) return false;

      // Valid mention, get id
      content = state.src.slice(start + 2, start + 2 + i);

      // Create token
      const ttype =
        type === mtype[1]
          ? 'mention_member'
          : type === rtype[1]
            ? 'mention_role'
            : 'mention_channel';
      token = state.push(ttype, '', 0);
      token.content = content;

      // Update position
      state.pos = start + 3 + i;

      return true;
    });

    md.renderer.rules.mention_member = (
      tokens,
      idx,
      opts,
      env: MarkdownEnv,
    ) => {
      const id = `profiles:${tokens[idx].content}`;
      const alias = env.domain?.id
        ? getMemberSync(env.domain.id, id)?.alias || '_'
        : env.members
          ? env.members[id]?.alias || '_'
          : '_';
      return `<span class="avid-highlight avid-mention-member" data-type="pingMention" data-id="${id}" data-variant="member" data-label="${alias}">@${alias}</span>`;
    };

    md.renderer.rules.mention_role = (tokens, idx, opts, env: MarkdownEnv) => {
      const id = `roles:${tokens[idx].content}`;
      const role = env.domain?.roles?.[id];
      const name = role?.label || '_';
      // const badge = role?.badge ? ReactDomServer.renderToStaticMarkup(<Emoji id={role.badge} />) : null;
      return `<span class="avid-highlight avid-mention-role" data-type="pingMention" data-id="${id}" data-variant="role" data-label="${name}" >@${name}</span>`;
    };
  });

/** Caches */
let _cache = {
  message: {} as Record<
    string,
    {
      hash: number;
      rendered: string;
      has_ping: boolean;
    }
  >,
};

////////////////////////////////////////////////////////////
// Message fetcher
////////////////////////////////////////////////////////////

/** Key function */
function makeKeyFn(
  channel_id: string,
  thread_id: string | undefined,
  pinned: boolean | undefined,
  session: SessionState,
) {
  return (idx: number, prevData: RawMessage[]) => {
    // Don't retrieve if reached end
    if (prevData && prevData.length < config.app.message.query_limit) return;
    if (!session.token || !channel_id) return;

    // Return key with page number
    return `${channel_id}${thread_id ? '.' + thread_id : ''}.messages?${
      pinned ? 'pinned&' : ''
    }page=${idx}`;
  };
}

/** Message fetcher */
function fetcher(session: SessionState, domain: DomainWrapper | undefined) {
  return async (key: string) => {
    const parts = key.split('.');
    const channel_id = parts[0];
    const thread_id = parts.length === 3 ? parts[1] : undefined;
    const page = parseInt(key.split('=').at(-1) as string);
    const pinned = (parts.at(-1)?.split('&').length || 0) > 1;

    const results = await api(
      'GET /messages',
      {
        query: {
          channel: channel_id,
          private: channel_id.startsWith('private_channels') ? true : undefined,
          thread: thread_id,
          pinned,
          page,
          limit: pinned
            ? config.app.message.pinned_query_limit
            : config.app.message.query_limit,
        },
      },
      { session },
    );

    // Set members
    if (domain) {
      setMembers(domain.id, Object.values(results.members), {
        emit: false,
        override_online: false,
      });
    }

    // Render thread names
    const env = makeMarkdownEnv(domain, domain ? results.members : undefined);
    for (const thread of Object.values(results.threads))
      thread.name = renderMessage(thread.name, env);

    // Set threads
    setThreads(Object.values(results.threads));

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
    idx = messages[page].findIndex((x) => x.id === message_id);
    if (idx >= 0) break;
  }

  return { page, idx };
}

////////////////////////////////////////////////////////////
function updateSwrMessages(
  updater: (
    messages: RawMessage[][],
    thread_id: string | undefined,
    pinned: boolean | undefined,
  ) => RawMessage[][] | undefined,
  message: { thread?: string; pinned?: boolean },
  channel_id: string,
  thread_id: string | undefined,
  pinned: boolean | undefined,
  session: SessionState,
) {
  // If thread id given, then should update main message hook
  if (thread_id || pinned !== undefined) {
    const key = makeKeyFn(channel_id, undefined, undefined, session);
    _mutate(
      unstable_serialize(key),
      async (messages: RawMessage[][] | undefined) =>
        updater(messages || [], undefined, undefined),
      { revalidate: false },
    );
  }

  if (!thread_id && message.thread) {
    const key = makeKeyFn(channel_id, message.thread, undefined, session);
    _mutate(
      unstable_serialize(key),
      async (messages: RawMessage[][] | undefined) =>
        updater(messages || [], message.thread, undefined),
      { revalidate: false },
    );
  }
  if (pinned === undefined && message.pinned !== undefined) {
    const key = makeKeyFn(channel_id, undefined, message.pinned, session);
    _mutate(
      unstable_serialize(key),
      async (messages: RawMessage[][] | undefined) =>
        updater(messages || [], undefined, message.pinned),
      { revalidate: false },
    );
  }
}

////////////////////////////////////////////////////////////
function copyToOtherHooks(
  messages: RawMessage[][] | undefined,
  message_id: string,
  channel_id: string,
  thread_id: string | undefined,
  pinned: boolean | undefined,
  session: SessionState,
) {
  if (!messages) return;

  // Find new message
  const { page, idx } = findMessage(messages, message_id);
  if (idx < 0) return;

  // Copy new message to other hooks
  const newMessage = messages[page][idx];
  updateSwrMessages(
    (messages) => {
      // Find message
      const { page, idx } = findMessage(messages, message_id);
      if (idx < 0) return messages;

      // Create copies
      const pagesCopy = messages.slice();
      const msgsCopy = pagesCopy[page].slice();
      msgsCopy[idx] = newMessage;
      pagesCopy[page] = msgsCopy;

      return pagesCopy;
    },
    newMessage,
    channel_id,
    thread_id,
    pinned,
    session,
  );
}

////////////////////////////////////////////////////////////
function addMessageLocal(
  messages: RawMessage[][] | undefined,
  message: RawMessage,
): RawMessage[][] | undefined {
  // Return message list with appended message
  const first = messages?.length ? messages[0] : [];
  return [[...first, message], ...(messages?.slice(1) || [])];
}

////////////////////////////////////////////////////////////
function editMessageLocal(
  messages: RawMessage[][] | undefined,
  message_id: string,
  message: string,
) {
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
function deleteMessageLocal(
  messages: RawMessage[][] | undefined,
  message_id: string,
) {
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
function _editMessageTemplate(
  messages: RawMessage[][] | undefined,
  message_id: string,
  fn: (msg: RawMessage) => RawMessage,
) {
  if (!messages) return undefined;

  // Find message
  const { page, idx } = findMessage(messages, message_id);
  if (idx < 0) return messages;

  // Create copies
  const pagesCopy = messages.slice();
  const msgsCopy = pagesCopy[page].slice();
  msgsCopy[idx] = fn(msgsCopy[idx]);
  pagesCopy[page] = msgsCopy;

  return pagesCopy;
}

////////////////////////////////////////////////////////////
const _selfReactions: Record<string, number> = {};

////////////////////////////////////////////////////////////
function addReactionLocal(
  messages: RawMessage[][] | undefined,
  message_id: string,
  emoji: string,
) {
  return _editMessageTemplate(messages, message_id, (msg) => {
    const copy = msg.reactions?.slice() || [];

    const idx = copy.findIndex((r) => r.emoji === emoji);
    if (idx >= 0)
      copy[idx] = { ...copy[idx], count: copy[idx].count + 1, self: 1 };
    else copy.push({ emoji, count: 1, self: 1 });

    // Mark this reaction as added
    _selfReactions[message_id + emoji] =
      (_selfReactions[message_id + emoji] || 0) + 1;

    return { ...msg, reactions: copy };
  });
}

////////////////////////////////////////////////////////////
function removeReactionsLocal(
  messages: RawMessage[][] | undefined,
  message_id: string,
  emoji: string | undefined,
  self: boolean,
) {
  return _editMessageTemplate(messages, message_id, (msg) => {
    const copy = msg.reactions?.slice() || [];

    // If neither specified, remove all reactions
    if (!self && !emoji) return { ...msg, reactions: undefined };

    if (emoji) {
      const idx = copy.findIndex((r) => r.emoji === emoji);
      if (idx >= 0) {
        // If self specified (should remove self emojis), then set self to 0
        copy[idx] = { ...copy[idx], count: copy[idx].count - 1 };
        if (self) {
          _selfReactions[message_id + emoji] =
            (_selfReactions[message_id + emoji] || 0) - 1;
          copy[idx].self = 0;
        }

        // Remove entry if empty
        if (copy[idx].count <= 0) copy.splice(idx, 1);
      }
    } else if (self) {
      for (let i = 0; i < copy.length; ++i) {
        if (copy[i].self) {
          copy[i] = { ...copy[i], count: copy[i].count - 1, self: 0 };

          // Remove entry if empty
          if (copy[i].count <= 0) {
            copy.splice(i, 1);
            --i;
          }

          const e = copy[i].emoji;
          _selfReactions[message_id + e] =
            (_selfReactions[message_id + e] || 0) - 1;
        }
      }
    }

    return { ...msg, reactions: copy };
  });
}

////////////////////////////////////////////////////////////
function mutators(
  mutate: KeyedMutator<RawMessage[][]>,
  session: SessionState,
  channel_id: string,
  domain_id: string | undefined,
  thread_id: string | undefined,
  pinned: boolean | undefined,
) {
  const isPrivate = channel_id.startsWith('private_channels');

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
    addMessage: (
      message: string,
      sender_id: string,
      options?: { attachments?: FileAttachment[]; reply_to?: ExpandedMessage },
    ) => {
      // Generate temporary id so we know which message to update with correct id
      const tempId = uuid();
      // Time message is sent
      const now = new Date().toISOString();

      return mutate(
        swrErrorWrapper(
          async (messages: RawMessage[][]) => {
            // TODO : Make attachments work in private channels
            const hasAttachments =
              domain_id &&
              options?.attachments &&
              options.attachments.length > 0;

            // Post all attachments
            const uploads = hasAttachments
              ? await uploadAttachments(
                  domain_id,
                  options?.attachments || [],
                  session,
                )
              : [];

            // Post message
            const results = await api(
              'POST /messages',
              {
                body: {
                  channel: channel_id,
                  reply_to: options?.reply_to?.id,
                  thread: thread_id,
                  message,
                  attachments: hasAttachments ? uploads : undefined,
                },
              },
              { session },
            );

            // Find reply to raw message
            let replyToRaw: RawMessage | undefined;
            if (options?.reply_to?.id) {
              const { page, idx } = findMessage(messages, options.reply_to.id);
              replyToRaw = messages[page][idx];
            }

            const newMessage = { ...results, reply_to: replyToRaw as Message };

            // For updating threads
            updateSwrMessages(
              (messages) => {
                const copy = addMessageLocal(messages, newMessage) || [];

                // Remove temp id message
                const { page, idx } = findMessage(copy, tempId);
                if (idx >= 0) copy[page].splice(idx, 1);

                return copy;
              },
              results,
              channel_id,
              thread_id,
              pinned,
              session,
            );

            // Update thread latest activity
            if (results.thread) {
              _mutate(
                `${channel_id}.threads`,
                (threads: Thread[] | undefined) => {
                  if (!threads) return;
                  const idx = threads.findIndex((x) => x.id === results.thread);
                  if (idx < 0) return threads;

                  const copy = threads.slice();
                  copy[idx] = {
                    ...copy[idx],
                    last_active: new Date().toISOString(),
                  };

                  return copy;
                },
              );
            }

            // Update message with the correct id
            return addMessageLocal(messages, newMessage);
          },
          { message: 'An error occurred while posting message' },
        ),
        {
          optimisticData: (messages) => {
            // Find reply to raw message
            let replyToRaw: RawMessage | undefined;
            if (messages && options?.reply_to?.id) {
              const { page, idx } = findMessage(messages, options.reply_to.id);
              replyToRaw = messages[page][idx];
            }

            // Create message
            const msg = {
              id: tempId,
              channel: channel_id,
              sender: sender_id,
              reply_to: replyToRaw as Message,
              thread: thread_id,
              message,
              attachments: options?.attachments?.map((f) => ({
                ...f,
                filename: f.file.name,
                url: f.type === 'image' ? URL.createObjectURL(f.file) : '',
                file: undefined,
              })),
              created_at: now,
            };

            // optimistically update other message hooks
            updateSwrMessages(
              (messages) => addMessageLocal(messages, msg),
              msg,
              channel_id,
              thread_id,
              pinned,
              session,
            );

            // Add message locally with temp id
            return addMessageLocal(messages, msg) || [];
          },
          revalidate: false,
        },
      );
    },

    /**
     * Edit a message (only the text parts)
     *
     * @param message_id The id of the message to edit
     * @param message The new message text to set
     * @returns The new message pages
     */
    editMessage: (message_id: string, message: string) =>
      mutate(
        swrErrorWrapper(
          async (messages: RawMessage[][]) => {
            // Send update query
            const results = await api(
              'PATCH /messages/:message_id',
              {
                params: { message_id },
                body: { message, private: isPrivate },
              },
              { session },
            );

            // Create new messages array
            const newMessages = editMessageLocal(
              messages,
              message_id,
              results.message,
            );

            // Update for other hooks
            copyToOtherHooks(
              newMessages,
              message_id,
              channel_id,
              thread_id,
              pinned,
              session,
            );

            return newMessages;
          },
          { message: 'An error occurred while editing message' },
        ),
        {
          optimisticData: (messages) => {
            // Add message locally with temp id
            return editMessageLocal(messages, message_id, message) || [];
          },
          revalidate: false,
        },
      ),

    /**
     * Delete a message
     *
     * @param message_id The id of the message to delete
     * @returns The new message pages
     */
    deleteMessage: (message_id: string) =>
      mutate(
        swrErrorWrapper(
          async (messages: RawMessage[][]) => {
            // Send delete query
            await api(
              'DELETE /messages/:message_id',
              { params: { message_id }, query: { private: isPrivate } },
              { session },
            );

            // Find message to check if it needs to be updated in thread view
            const { page, idx } = findMessage(messages, message_id);
            const messageObj = idx >= 0 ? messages[page][idx] : {};

            // Update message locally
            updateSwrMessages(
              (messages) => deleteMessageLocal(messages, message_id),
              messageObj,
              channel_id,
              thread_id,
              pinned,
              session,
            );
            return deleteMessageLocal(messages, message_id);
          },
          { message: 'An error occurred while deleting message' },
        ),
        {
          optimisticData: (messages) => {
            return deleteMessageLocal(messages, message_id) || [];
          },
          revalidate: false,
        },
      ),

    /**
     * Add a message locally. This message will not be posted to the database.
     * This should be used to display messages received through websockets.
     *
     * @param message The message to add
     * @param reader The member that is viewing the messages (used to highlight member pings)
     * @returns The new grouped messages
     */
    addMessageLocal: (message: RawMessage) =>
      mutate(
        swrErrorWrapper(
          async (messages: RawMessage[][]) => {
            updateSwrMessages(
              (messages) => addMessageLocal(messages, message),
              message,
              channel_id,
              thread_id,
              pinned,
              session,
            );
            return addMessageLocal(messages, message);
          },
          { message: 'An error occurred while displaying a message' },
        ),
        { revalidate: false },
      ),

    /**
     * Edit a message locally. These changes will not be sent to database.
     * This should be used to display messages received through websockets.
     *
     * @param message_id The id of the message to edit
     * @param message The new message values to set
     * @returns The new grouped messages
     */
    editMessageLocal: (message_id: string, message: Partial<RawMessage>) =>
      mutate(
        swrErrorWrapper(
          async (messages: RawMessage[][]) => {
            // Find message to check if it needs to be updated in thread view
            const { page, idx } = findMessage(messages, message_id);
            const messageObj = idx >= 0 ? messages[page][idx] : {};

            updateSwrMessages(
              (messages) =>
                _editMessageTemplate(messages, message_id, (msg) => ({
                  ...msg,
                  ...message,
                })),
              messageObj,
              channel_id,
              thread_id,
              pinned,
              session,
            );
            return _editMessageTemplate(messages, message_id, (msg) => ({
              ...msg,
              ...message,
            }));
          },
          { message: 'An error occurred while displaying an edited message' },
        ),
        { revalidate: false },
      ),

    /**
     * Delete a message locally. These changes will not be sent to database.
     * This should be used to display messages received through websockets.
     *
     * @param message_id The id of the message to delete
     * @returns The new grouped messages
     */
    deleteMessageLocal: (message_id: string) =>
      mutate(
        swrErrorWrapper(
          async (messages: RawMessage[][]) => {
            // Find message to check if it needs to be updated in thread view
            const { page, idx } = findMessage(messages, message_id);
            const messageObj = idx >= 0 ? messages[page][idx] : {};

            updateSwrMessages(
              (messages) => deleteMessageLocal(messages, message_id),
              messageObj,
              channel_id,
              thread_id,
              pinned,
              session,
            );
            return deleteMessageLocal(messages, message_id);
          },
          { message: 'An error occurred while displaying an edited message' },
        ),
        { revalidate: false },
      ),

    /**
     * Pin a message to a channel
     *
     * @param message_id The id of the message to pin
     * @returns The new messages array
     */
    pinMessage: (message_id: string) =>
      mutate(
        swrErrorWrapper(async (messages: RawMessage[][]) => {
          // Pin message
          await api(
            'PATCH /messages/:message_id',
            {
              params: { message_id },
              body: { pinned: true, private: isPrivate },
            },
            { session },
          );

          // Add to pinned hook
          const { page, idx } = findMessage(messages, message_id);
          if (idx >= 0) {
            const messageObj = { ...messages[page][idx], pinned: true };
            updateSwrMessages(
              (messages) => {
                const { page, idx } = findMessage(messages, message_id);

                // If message already exists, update the object
                if (idx >= 0) {
                  const copy = messages.slice();
                  const pagesCopy = copy[page].slice();
                  pagesCopy[idx] = messageObj;
                  copy[page] = pagesCopy;
                  return copy;
                }

                // Otherwise insert this message
                else {
                  // The chance of a user pinning a message that goes past the first page is low, so don't bother handling it
                  const newMessages =
                    addMessageLocal(messages, messageObj) || [];
                  // Sort to keep correct order
                  if (newMessages.length > 0)
                    newMessages[newMessages.length - 1].sort(
                      (a, b) =>
                        new Date(a.created_at).getTime() -
                        new Date(b.created_at).getTime(),
                    );

                  return newMessages;
                }
              },
              messageObj,
              channel_id,
              thread_id,
              pinned,
              session,
            );
          }

          return _editMessageTemplate(messages, message_id, (msg) => ({
            ...msg,
            pinned: true,
          }));
        }),
        { revalidate: false },
      ),

    /**
     * Unpin a message to a channel
     *
     * @param message_id The id of the message to unpin
     * @returns The new messages array
     */
    unpinMessage: (message_id: string) =>
      mutate(
        swrErrorWrapper(async (messages: RawMessage[][]) => {
          // Pin message
          await api(
            'PATCH /messages/:message_id',
            {
              params: { message_id },
              body: { pinned: false, private: isPrivate },
            },
            { session },
          );

          // Update other hooks
          const { page, idx } = findMessage(messages, message_id);
          if (idx >= 0) {
            const messageObj = { ...messages[page][idx], pinned: true };
            updateSwrMessages(
              (messages, thread_id, pinned) => {
                // If a pin hook, delete the message
                // console.log(messages, thread_id, pinned);
                if (pinned !== undefined)
                  return deleteMessageLocal(messages, message_id);
                else
                  return _editMessageTemplate(
                    messages,
                    message_id,
                    (msg) => messageObj,
                  );
              },
              messageObj,
              channel_id,
              thread_id,
              pinned,
              session,
            );
          }

          // If this is a pinned message hook, the remove it from list
          if (pinned) return deleteMessageLocal(messages, message_id) || [];
          else
            return _editMessageTemplate(messages, message_id, (msg) => ({
              ...msg,
              pinned: false,
            }));
        }),
        { revalidate: false },
      ),

    /**
     * Add a reaction to a message
     *
     * @param message_id The id of the mssage to add the reaction to
     * @param emoji The emoji to react with
     * 
     * @returns The new messages array
     */
    addReaction: errorWrapper(
      async (message_id: string, emoji: string) => {
        // Optimistic update
        let newMessages: RawMessage[][] = [];
        await mutate(
          (messages) => {
            newMessages = addReactionLocal(messages, message_id, emoji) || [];
            return newMessages;
          },
          { revalidate: false },
        );

        // Actual update
        await api(
          'POST /reactions',
          {
            body: { message: message_id, emoji, private: isPrivate },
          },
          { session },
        );

        // Update for other hooks
        copyToOtherHooks(
          newMessages,
          message_id,
          channel_id,
          thread_id,
          pinned,
          session,
        );
      },
      { message: 'An error occurred while adding message reaction' },
    ),

    /**
     * Remove reactions from a message, based on certain options
     *
     * @param message_id The id of the mssage to add the reaction to
     * @param emoji The emoji to react with
     * @returns The new messages array
     */
    removeReactions: errorWrapper(
      async (
        message_id: string,
        options?: { self?: boolean; emoji?: string },
      ) => {
        // Optimistic update
        let newMessages: RawMessage[][] = [];
        await mutate(
          (messages) => {
            newMessages =
              removeReactionsLocal(
                messages,
                message_id,
                options?.emoji,
                options?.self || false,
              ) || [];
            return newMessages;
          },
          { revalidate: false },
        );

        // Actual update
        await api(
          'DELETE /reactions',
          {
            query: {
              message: message_id,
              member: options?.self ? session.profile_id : undefined,
              emoji: options?.emoji,
              private: isPrivate,
            },
          },
          { session },
        );

        // Update for other hooks
        copyToOtherHooks(
          newMessages,
          message_id,
          channel_id,
          thread_id,
          pinned,
          session,
        );
      },
      { message: 'An error occurred while removing message reactions' },
    ),

    /**
     * Apply a group of reactions changes for a message. This data is only applied locally.
     *
     * @param message_id The message to apply reaction changes for
     * @param changes A map of emojis to the difference in count since the last update
     * @param removeAll Set this to true to remove all reactions on message
     * @returns The new messages
     */
    applyReactionChanges: (
      message_id: string,
      changes: Record<string, number>,
      removeAll?: boolean,
    ) =>
      mutate(
        swrErrorWrapper(
          async (messages: RawMessage[][]) => {
            // Find message to check if it needs to be updated in thread view
            const { page, idx } = findMessage(messages, message_id);
            const messageObj = idx >= 0 ? messages[page][idx] : {};

            // Remove all
            if (removeAll) {
              // Remove all reactions
              const newMessages = _editMessageTemplate(
                messages,
                message_id,
                (msg) => ({ ...msg, reactions: undefined }),
              );

              // Update for other hooks
              copyToOtherHooks(
                newMessages,
                message_id,
                channel_id,
                thread_id,
                pinned,
                session,
              );

              return newMessages;
            }

            // New messages for this hook
            const newMessages = _editMessageTemplate(
              messages,
              message_id,
              (msg: RawMessage) => {
                const copy = msg.reactions?.slice() || [];

                // Create map of emoji to index
                const emojiMap: Record<string, number> = {};
                for (let i = 0; i < copy.length; ++i)
                  emojiMap[copy[i].emoji] = i;

                // Array of deleted reaction indices
                const deleted: number[] = [];

                for (const [emoji, delta] of Object.entries(changes)) {
                  // Get self reactions
                  const key = message_id + emoji;
                  const self = _selfReactions[key];

                  // Total change in count
                  const deltaWithSelf = delta - (self || 0);

                  const idx = emojiMap[emoji];
                  if (idx !== undefined) {
                    copy[idx] = {
                      ...copy[idx],
                      count: copy[idx].count + deltaWithSelf,
                    };
                    if (copy[idx].count <= 0) deleted.push(idx);
                  } else if (deltaWithSelf > 0)
                    copy.push({
                      emoji,
                      count: deltaWithSelf,
                      self: self === undefined ? 0 : 1,
                    });

                  // Delete self reaction
                  delete _selfReactions[key];
                }

                // Delete reactions
                deleted.sort((a, b) => b - a);
                for (const idx of deleted) copy.splice(idx, 1);

                return { ...msg, reactions: copy };
              },
            );

            // Update for other hooks
            copyToOtherHooks(
              newMessages,
              message_id,
              channel_id,
              thread_id,
              pinned,
              session,
            );

            return newMessages;
          },
          { message: 'An error occurred while updating reactions' },
        ),
        { revalidate: false },
      ),
  };
}

/** Mutators that will be attached to the grouped messages swr wrapper */
export type MessageMutators = ReturnType<typeof mutators>;
/** Swr data wrapper for grouped messages */
export type MessagesWrapper<Loaded extends boolean = true> = SwrWrapper<
  RawMessage[],
  Loaded,
  MessageMutators,
  true,
  true
>;

/**
 * Retrieve messages for the specified channel.
 * Messages returned from this hook are grouped by day and time proximity/sender.
 * All messages are fully rendered to html.
 *
 * @param channel_id The id of the channel to retrieve messages from
 * @param domain_id The domain the channel belongs to (used to cache member objects)
 * @param options.thread_id The thread id for which only messages of this thread should be fetched
 * @param options.pinned If only pinned messages should be fetched
 * @returns A list of messages sorted oldest first
 */
export function useMessages(
  channel_id: string | undefined,
  domain: DomainWrapper | undefined,
  options?: { thread_id?: string; pinned?: boolean },
) {
  const session = useSession();

  // Key function
  const keyFn = useMemo(
    () =>
      channel_id
        ? makeKeyFn(channel_id, options?.thread_id, options?.pinned, session)
        : () => undefined,
    [channel_id, options?.thread_id, options?.pinned, session],
  );

  // Infinite loader
  const swr = useSWRInfinite<RawMessage[]>(keyFn, fetcher(session, domain), {
    revalidateFirstPage: false,
  });

  // Wrapper
  const wrapper = useSwrWrapper<
    RawMessage[],
    MessageMutators,
    true,
    RawMessage[],
    true
  >(swr, {
    transform: (messages) => {
      // Flatten array
      let flattened: RawMessage[] = [];
      for (let p = messages.length - 1; p >= 0; --p)
        flattened = flattened.concat(messages[p]);

      return flattened;
    },
    pageSize: config.app.message.query_limit,
    mutators,
    mutatorParams: [
      channel_id,
      domain?.id,
      options?.thread_id,
      options?.pinned,
    ],
    separate: true,
    session,
  });
  return wrapper;
}

////////////////////////////////////////////////////////////
// Message grouper + renderer
////////////////////////////////////////////////////////////

/** Create markdown render env */
export function makeMarkdownEnv(domain: DomainWrapper | undefined, members?: Record<string, ExpandedPrivateMember>): MarkdownEnv {
  // Construct roles map
  const roleMap: Record<string, Role> = {};
  for (const r of domain?.roles || []) roleMap[r.id] = r;

  return {
    domain: domain ? { id: domain.id, roles: roleMap } : undefined,
    members,
  } as MarkdownEnv;
}

/** Render a single message */
export function renderMessage(message: string, env: MarkdownEnv) {
  // Render new message
  let rendered = _md.render(message, env);

  // Native emojis
  rendered = renderNativeEmojis(rendered);

  return rendered;
}

/** Add a single message to a day group message */
function addMessageToDayGroup(
  group: ExpandedMessageWithPing[][],
  msg: ExpandedMessageWithPing,
) {
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
function groupAllMessages(
  messages: RawMessage[],
  reader: MinMember,
  env: MarkdownEnv,
): GroupedMessages {
  assert(reader.id);

  const rendered: ExpandedMessageWithPing[] = [];

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
        membersLoaded =
          membersLoaded &&
          (env.members !== undefined ||
            (env.domain !== undefined &&
              getMemberSync(env.domain.id, id) !== null));

      // Save to cache
      cached = {
        hash: membersLoaded ? hash : 0,
        rendered: renderMessage(msg.message, env),
        has_ping: ping,
      };
      _cache.message[msg.id] = cached;
    }

    // Render replied to message
    let renderedReplied = msg.reply_to;
    if (renderedReplied) {
      // Check if message changed
      const hash = shash(renderedReplied.message);

      let repliedCached = _cache.message[renderedReplied.id];
      if (!repliedCached || repliedCached.hash !== hash) {
        // Save to cache
        repliedCached = {
          hash,
          rendered: renderMessage(renderedReplied.message, env),
          has_ping: false,
        };
        _cache.message[renderedReplied.id] = repliedCached;
      }

      // Create rendered replied to message
      renderedReplied = { ...renderedReplied, message: repliedCached.rendered };
    }

    // Add to rendered list
    // console.log('render msg', env)
    const renderedMsg = {
      ...msg,
      message: cached.rendered,
      sender: msg.sender
        ? env.domain
          ? getMemberSync(env.domain.id, msg.sender)
          : env.members?.[msg.sender]
        : null,
      thread: msg.thread ? getThreadSync(msg.thread) : null,
      pinged: cached.has_ping,
      reply_to: renderedReplied,
    } as ExpandedMessageWithPing;
    rendered.push(renderedMsg);
  }

  // Group by day
  const groupedByDay = groupBy(rendered, (msg) =>
    moment(msg.created_at).startOf('day').format(),
  );

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
 * @param reader The member that is viewing the messages (used to highlight member pings)
 * @param options.domain The domain the channel belongs to (used to correctly render mentions, emotes, etc.)
 * @returns The messages rendered and grouped
 */
export function useGroupedMessages(
  messages: RawMessage[],
  reader: MinMember,
  options?: {
    domain?: DomainWrapper<false>;
    members?: ExpandedPrivateMember[];
  },
) {
  const members = useMemberCache();
  const threads = useThreadCache();

  // Create md render env
  const env = useMemo<MarkdownEnv | undefined>(() => {
    if (options?.domain && !options.domain._exists) return;
    // Create member map if needed
    const memberMap: Record<string, ExpandedPrivateMember> = {};
    if (options?.members) {
      for (const m of options.members)
        memberMap[m.id] = m;
    }

    return makeMarkdownEnv(options?.domain as DomainWrapper, options?.members ? memberMap : undefined);
  }, [options?.domain?.id, options?.domain?.roles, options?.members]);

  // WIP : make side panel buttons work, make chat app state work

  return useMemo(() => {
    // console.log(messages, members, env)
    if (reader._exists === false || !env) return;
    return groupAllMessages(messages, reader, env);
  }, [messages, members, threads, reader._exists, env]);
}
