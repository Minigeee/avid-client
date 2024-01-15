import { KeyedMutator } from 'swr';
import { cache } from 'swr/_internal';
import assert from 'assert';

import { api, deleteDomainImage, uploadDomainImage } from '@/lib/api';
import { SessionState } from '@/lib/contexts';
import {
  AllPermissions,
  ChannelData,
  ChannelOptions,
  ChannelTypes,
  ExpandedDomain,
  ExpandedMember,
  ExpandedPrivateChannel,
  Member,
  Role,
} from '@/lib/types';
import { swrErrorWrapper } from '@/lib/utility/error-handler';

import { useApiQuery } from './use-api-query';
import { setMembers } from './use-members';
import { SwrWrapper } from './use-swr-wrapper';

////////////////////////////////////////////////////////////
function mutators(
  mutate: KeyedMutator<ExpandedPrivateChannel[]>,
  session: SessionState | undefined,
) {
  assert(session);

  return {
    /**
     * Create a new private channel
     *
     * @param options Channel initial options
     * @param options.name The name of the private channel
     * @param options.members The profile ids of the initial members of the channel
     * @param options.multi_member Whether the channel should allow more than two members
     * @returns The new list of private channels
     */
    createChannel: (options?: {
      name?: string;
      members?: string[];
      multi_member?: boolean;
    }) =>
      mutate(
        swrErrorWrapper(
          async (channels: ExpandedPrivateChannel[]) => {
            // Create new private channel
            const result = await api(
              'POST /private_channels',
              {
                body: options || {},
              },
              { session },
            );

            // Prepend
            return [result, ...channels];
          },
          { message: 'An error occurred while creating new private channel' },
        ),
        { revalidate: false },
      ),

    /**
     * Change the name of a private channel
     *
     * @param channel_id THe id of the private channel
     * @param name The new name of the private channel
     * @returns The new list of private channels
     */
    renameChannel: (channel_id: string, name: string) =>
      mutate(
        swrErrorWrapper(
          async (channels: ExpandedPrivateChannel[]) => {
            // Rename channel
            const result = await api(
              'PATCH /private_channels/:channel_id',
              {
                params: { channel_id },
                body: { name },
              },
              { session },
            );

            const copy = channels.slice();
            const idx = copy.findIndex((x) => x.id === channel_id);
            if (idx >= 0) copy[idx] = { ...copy[idx], ...result };

            return copy;
          },
          { message: 'An error occurred while renaming private channel' },
        ),
        {
          revalidate: false,
          optimisticData: (channels) => {
            if (!channels) return [];

            const copy = channels.slice();
            const idx = copy.findIndex((x) => x.id === channel_id);
            if (idx >= 0) copy[idx] = { ...copy[idx], name };

            return copy;
          },
        },
      ),
  };
}

/** Mutators that will be attached to the private channels swr wrapper */
export type PrivateChannelsMutators = ReturnType<typeof mutators>;
/** Swr data wrapper for threads */
export type PrivateChannelsWrapper<Loaded extends boolean = true> = SwrWrapper<
  ExpandedPrivateChannel[],
  Loaded,
  PrivateChannelsMutators
>;


/** Default value for domain */
let _defaults: Record<string, ExpandedPrivateChannel[]> = {};

/** Get domain swr key */
export function setPrivChannelsDefault(channels: ExpandedPrivateChannel[]) {
  _defaults.value = channels;
}

/**
 * Retrieve a list of private channels the user has access to.
 *
 * @returns A list of private channels, sorted latest activity first
 */
export function usePrivateChannels() {
  return useApiQuery(
    'private_channels',
    'GET /private_channels',
    {},
    {
      mutators,
      then: (results) => {
        // Reset default
        if (_defaults.value) delete _defaults.value;
        return results;
      },
      initial: _defaults.value,
    },
  );
}


/**
 * Get the members of a private channel
 * 
 * @param channel_id The channel to retrieve members for
 * @returns A list of channel members
 */
export function usePrivateMembers(channel_id: string | undefined) {
  return useApiQuery(
    channel_id ? `${channel_id}.members` : undefined,
    'GET /private_channels/:channel_id/members',
    {
      params: { channel_id: channel_id || '' },
    },
    {},
  );
}