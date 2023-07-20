import { KeyedMutator } from 'swr';
import { ScopedMutator, useSWRConfig } from 'swr/_internal';
import assert from 'assert';

import { deleteProfile, uploadDomainImage, uploadProfile } from '@/lib/api';
import { id, query, sql } from '@/lib/db';
import { Channel, Domain, ExpandedMember, ExpandedProfile, Member, Role } from '@/lib/types';
import { SessionState } from '@/lib/contexts';

import { withAccessToken } from '@/lib/api/utility';
import { swrErrorWrapper } from '@/lib/utility/error-handler';

import { SwrWrapper } from './use-swr-wrapper';
import { useDbQuery } from './use-db-query';

import axios from 'axios';


////////////////////////////////////////////////////////////
function updateLocalMembers(profile_id: string, url: string | null, _mutate: ScopedMutator) {
	// Update member objects
	_mutate(
		(key) => typeof key === 'string' && (new RegExp(`^domains:\\w+\\.${profile_id}$`).test(key) || /^domains:\w+\.members/.test(key)),
		(data: ExpandedMember | { data: ExpandedMember[] } | undefined) => {
			if (!data) return data;

			if (!(data as { data: ExpandedMember[] }).data) {
				return { ...data, profile_picture: url };
			}
			else {
				const members = (data as { data: ExpandedMember[] }).data;
				const idx = members.findIndex(x => x.id === profile_id);
				if (idx < 0) return data;

				const copy = members.slice();
				copy[idx] = { ...members[idx], profile_picture: url };
				return { ...data, data: copy };
			}
		},
		{ revalidate: false }
	);
}

////////////////////////////////////////////////////////////
function mutators(mutate: KeyedMutator<ExpandedProfile>, session: SessionState | undefined, _mutate: ScopedMutator) {
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
				const results = await axios.post<{ domain: Domain }>(
					'/api/domains',
					{ name },
					withAccessToken(session)
				);
				const domain = results.data.domain;

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
				const results = await axios.post(`/api/domains/join/${id(domain_id)}`, {}, withAccessToken(session));

				return {
					...profile,
					domains: [...profile.domains, results.data],
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
				updateLocalMembers(profile.id, url, _mutate);

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
				updateLocalMembers(profile.id, null, _mutate);

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


/**
 * A swr hook that retrieves the current profile.
 * 
 * @param profile_id The id of the domain to retrieve
 * @returns A swr wrapper object containing the requested profile
 */
export function useProfile(profile_id: string | undefined) {
	assert(!profile_id || profile_id.startsWith('profiles:'));
	const { mutate } = useSWRConfig();

	return useDbQuery<ExpandedProfile, ProfileMutators>(profile_id, {
		builder: (key) => {
			assert(profile_id);

			return sql.select([
				'*',
				sql.wrap(sql.select<Domain>(
					['id', 'name', 'icon', 'time_created'],
					{ from: '->member_of->domains' }
				), { alias: 'domains' }),
			], { from: profile_id });
		},
		then: (results) => results?.length ? {
			...results[0],
			// TODO : Make domains draggable
			domains: results[0].domains.sort((a: Domain, b: Domain) => new Date(a.time_created).getTime() - new Date(b.time_created).getTime()),
		} : null,
		
		mutators,
		mutatorParams: [mutate],
	});
}