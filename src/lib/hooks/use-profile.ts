import { KeyedMutator } from 'swr';
import assert from 'assert';

import { deleteProfile, uploadDomainImage, uploadProfile } from '@/lib/api';
import { ExpandedProfile } from '@/lib/types';
import { SessionState } from '@/lib/contexts';

import { api } from '@/lib/api/utility';
import { swrErrorWrapper } from '@/lib/utility/error-handler';

import { SwrWrapper } from './use-swr-wrapper';
import { updateMemberLocal } from './use-members';

import { useApiQuery } from './use-api-query';


////////////////////////////////////////////////////////////
function mutators(mutate: KeyedMutator<ExpandedProfile>, session: SessionState | undefined) {
	assert(session);

	return {
		/**
		 * Create new domain and add user as its first member
		 * 
		 * @param name The name of the domain
		 * @returns The new profile object
		 */
		addDomain: (name: string, icon?: { file: Blob, name: string }) => mutate(
			swrErrorWrapper(async (profile: ExpandedProfile) => {
				// Domain create api
				const domain = await api('POST /domains', {
					body: { name },
				}, { session });

				// Upload icon image if given
				if (icon) {
					const url = await uploadDomainImage(domain.id, 'icon', icon.file, icon.name, session);
					domain.icon = url;
				}

				// Add domain id to profiles
				return {
					...profile,
					domains: [...profile.domains, domain],
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
				// Use api to join
				const results = await api('POST /domains/join/:join_id', {
					params: { join_id: domain_id },
				}, { session });

				return {
					...profile,
					domains: [...profile.domains, results],
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
				// Upload profile image
				const url = await uploadProfile(profile, image, fname, session);

				// Update member objects
				updateMemberLocal(profile.id, (member) => ({ ...member, profile_picture: url }));

				return {
					...profile,
					profile_picture: url,
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
				// Delete profile image
				await deleteProfile(profile, session);

				// Update member objects
				updateMemberLocal(profile.id, (member) => ({ ...member, profile_picture: null }));

				return {
					...profile,
					profile_picture: null,
				};
			}, { message: 'An error occurred while removing profile picture' }),
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
export type ProfileWrapper<Loaded extends boolean = true> = SwrWrapper<ExpandedProfile, Loaded, ProfileMutators>;


/** Default value for domain */
let _defaults: Record<string, ExpandedProfile> = {};

/** Get domain swr key */
export function setProfileDefault(profile: ExpandedProfile) {
	_defaults[profile.id] = profile;
}

/**
 * A swr hook that retrieves the current profile.
 * 
 * @param profile_id The id of the domain to retrieve
 * @returns A swr wrapper object containing the requested profile
 */
export function useProfile(profile_id: string | undefined) {
	return useApiQuery(profile_id, 'GET /profiles/:profile_id', {
		params: { profile_id: profile_id || '' },
	}, {
		then: (result) => {
			// Reset default
			if (_defaults[profile_id || ''])
				delete _defaults[profile_id || ''];

			return result;
		},
		mutators,
		initial: profile_id ? _defaults[profile_id] : undefined,
	});
}