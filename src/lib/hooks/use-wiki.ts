import useSWR, { KeyedMutator, mutate as _mutate } from 'swr';
import assert from 'assert';

import config from '@/config';
import { api } from '@/lib/api';
import { SessionState } from '@/lib/contexts';
import { Wiki } from '@/lib/types';

import { renderNativeEmojis } from '@/lib/utility/emoji';
import { swrErrorWrapper } from '@/lib/utility/error-handler';

import { SwrWrapper } from './use-swr-wrapper';

import sanitizeHtml from 'sanitize-html';
import { useApiQuery } from './use-api-query';
import { setMembers } from './use-members';


////////////////////////////////////////////////////////////
function _sanitize(wiki: Wiki) {
  wiki.content = renderNativeEmojis(
    sanitizeHtml(wiki.content, config.sanitize),
  );

  if (wiki.draft)
    wiki.draft = renderNativeEmojis(sanitizeHtml(wiki.draft, config.sanitize));

  return wiki;
}

////////////////////////////////////////////////////////////
function mutators(
  mutate: KeyedMutator<Wiki>,
  session: SessionState | undefined,
) {
  assert(session);

  return {
    /**
     * Update a wiki document
     * 
     * @param options.content The new content to set (saves and publishes newest changes)
     * @param options.draft The work in progress text that will only be visible by document editors
     * @returns The new wiki document
     */
    updateWiki: (options: { content?: string; draft?: string }) =>
      mutate(
        swrErrorWrapper(
          async (wiki: Wiki) => {
            // Update wiki
            const result = await api(
              'PATCH /wikis/:wiki_id',
              {
                params: { wiki_id: wiki.id },
                body: options,
              },
              { session },
            );

            return _sanitize(result);
          },
          { message: 'An error occurred while updating wiki document' },
        ),
        {
          revalidate: false,
        },
      ),
  };
}

/**
 * Get wiki document
 * 
 * @param channel_id The channel the document belongs to
 * @param draft Should the draft version be retrieved also
 */
export function useWiki(
  channel_id: string | undefined,
  draft: boolean = false,
) {
  return useApiQuery(
    channel_id ? `${channel_id}/wiki` : undefined,
    'GET /wikis/:wiki_id',
    {
      params: { wiki_id: channel_id || '' },
      query: { draft },
    },
    {
      then: (results) => _sanitize(results),
      mutators,
    },
  );
}
