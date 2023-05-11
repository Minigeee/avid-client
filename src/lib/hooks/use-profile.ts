import { KeyedMutator } from 'swr';
import assert from 'assert';

import { getDomainCache, id, query, sql } from '@/lib/db';
import { Channel, Domain, ExpandedProfile, Member, Role } from '@/lib/types';
import { SessionState } from '@/lib/contexts';

import { swrErrorWrapper } from '@/lib/utility/error-handler';
import { SwrWrapper } from '@/lib/utility/swr-wrapper';
import { useDbQuery } from './use-db-query';

import axios from 'axios';


////////////////////////////////////////////////////////////
function mutators(mutate: KeyedMutator<ExpandedProfile>, session?: SessionState) {
	assert(session);

	return {
		/**
		 * Create new domain and add user as its first member
		 * 
		 * @param name The name of the domain
		 * @returns The new profile object
		 */
		addDomain: (name: string) => mutate(
			swrErrorWrapper(async (profile: ExpandedProfile) => {
				// Time domain is created
				const now = new Date().toISOString();

				// Create new domain with the specified name and make user join
				const results = await query<Domain[]>(sql.transaction([
					// TODO : Create default channels where each channel type is handled correctly
					sql.let('$channels', '[]'),
					// Create everyone role
					sql.let('$role', sql.create<Role>('roles', { label: 'everyone' })),
					// Create domain
					sql.let('$domain', sql.create<Domain>('domains', {
						name,
						roles: [sql.$('$role.id')],
						channels: sql.fn<Domain>(function(channels: Channel[]) {
							return channels.map(x => x.id);
						}),
						time_created: now,
						_default_role: sql.$('$role.id'),
					})),
					// Add member to domain
					sql.relate<Member>(profile.id, 'member_of', '$domain.id', {
						content: {
							alias: profile.username,
							roles: [sql.$('$role.id')],
							time_joined: now,
						},
					}),
					// Return id of domain
					sql.select<Domain>('*', { from: '$domain' }),
				]), { session });
				assert(results && results.length > 0);

				// Add domain id to profiles
				return {
					...profile,
					domains: [...profile.domains, results[0]],
				};
			}, { message: 'An error occurred while creating domain' }),
			{ revalidate: false }
		),

		/**
		 * Add user as a member of the specified domain
		 * 
		 * @param domain_id The domain to join
		 * @param alias The alias of the user
		 * @returns The new profile object
		 */
		joinDomain: (domain_id: string, alias: string) => mutate(
			swrErrorWrapper(async (profile: ExpandedProfile) => {
				// Try adding member, error will occur if the user is already a member
				const results = await query<Domain[]>(sql.multi([
					sql.let('$domain', sql.select<Domain>(['id', 'name', '_default_role'], { from: domain_id })),
					sql.relate<Member>(profile.id, 'member_of', domain_id, {
						content: {
							alias,
							roles: [sql.$('$domain._default_role')],
							time_joined: new Date().toISOString(),
						}
					}),
					sql.select('*', { from: '$domain' }),
				]), { session });
				assert(results && results.length > 0);

				return {
					...profile,
					domains: [...profile.domains, results[0]],
				};
			}, { message: 'An error occurred while joining the domain' }),
			{ revalidate: false }
		),

		/**
		 * Upload and set the specified image as the profile picture.
		 * 
		 * @param image The image data to set as profile picture
		 * @param fname The name of the original image file
		 * @returns The new profile object
		 */
		setPicture: (image: Blob, fname: string) => mutate(
			swrErrorWrapper(async (profile: ExpandedProfile) => {
				// Generate form data
				const formData = new FormData();
				formData.append('image', image, fname);
	  
				// Send image post
				const results = await axios.post<{ image: string }>(
				  `/api/upload/profile/${id(profile.id)}`,
				  formData
				);

				// Change profile pictures of all domains that are loaded
				for (const d of profile.domains) {
					try {
						const cache = await getDomainCache(d.id, session, true);
						const obj = cache.cache._data[profile.id];
						if (obj?.data)
							obj.data.profile_picture = results.data.image;
					}
					catch (err) { }
				}

				return {
					...profile,
					profile_picture: results.data.image,
				};
			}, { message: 'An error occurred while setting profile picture' }),
			{ revalidate: false }
		),

		/**
		 * Remove the current profile picture. Performs optimistic update.
		 * 
		 * @param old_profile The old profile object used to rollback optimistic updates on error
		 * @returns The new profile picture
		 */
		removePicture: (old_profile: ExpandedProfile) => mutate(
			swrErrorWrapper(async (profile: ExpandedProfile) => {
				// Send delete request
				await axios.delete(`/api/upload/profile/${id(profile.id)}`);

				// Unset profile pictures of all domains that are loaded
				for (const d of profile.domains) {
					try {
						const cache = await getDomainCache(d.id, session, true);
						const obj = cache.cache._data[profile.id];
						if (obj?.data)
							obj.data.profile_picture = null;
					}
					catch (err) { }
				}

				return {
					...profile,
					profile_picture: null,
				};
			}, {
				message: 'An error occurred while removing profile picture',
				onError: async (error) => {
					// Reset profile image (swr doesn't handle rollback for these values)
					for (const d of old_profile.domains) {
						try {
							const cache = await getDomainCache(d.id, session, true);
							const obj = cache.cache._data[old_profile.id];
							if (obj?.data)
								obj.data.profile_picture = old_profile.profile_picture;
						}
						catch (err) { }
					}
				}
			}),
			{
				revalidate: false,
				optimisticData: (profile) => {
					assert(profile);
					return {
						...profile,
						profile_picture: null,
					};
				}
			}
		),
	};
}


/** Mutators that will be attached to the profile swr wrapper */
export type ProfileMutators = ReturnType<typeof mutators>;
/** Swr data wrapper for a profile object */
export type ProfileWrapper<Loaded extends boolean = true> = SwrWrapper<ExpandedProfile, ProfileMutators, false, Loaded>;


/**
 * A swr hook that retrieves the current profile.
 * 
 * @param profile_id The id of the domain to retrieve
 * @returns A swr wrapper object containing the requested profile
 */
export function useProfile(profile_id: string | undefined) {
	assert(!profile_id || profile_id.startsWith('profiles:'));

	return useDbQuery<ExpandedProfile, ProfileMutators>(profile_id, (key) => {
		assert(profile_id);

		return sql.select([
			'*',
			sql.wrap(sql.select<Domain>(
				['id', 'name', 'time_created'],
				{ from: '->member_of->domains' }
			), { alias: 'domains' }),
		], { from: profile_id });
	}, {
		then: (results) => results?.length ? {
			...results[0],
			// TODO : Make domains draggable
			domains: results[0].domains.sort((a: Domain, b: Domain) => new Date(a.time_created).getTime() - new Date(b.time_created).getTime()),
		 } : null,
		 mutators,
	});
}