import { KeyedMutator } from 'swr';
import assert from 'assert';

import { deleteProfile, uploadDomainImage, uploadProfile } from '@/lib/api';
import { ExpandedProfile, Profile } from '@/lib/types';
import { SessionState } from '@/lib/contexts';

import { api } from '@/lib/api/utility';
import { swrErrorWrapper } from '@/lib/utility/error-handler';

import { SwrWrapper } from './use-swr-wrapper';
import { updateMemberLocal } from './use-members';

import { useApiQuery } from './use-api-query';
import config from '@/config';
import { useMemo, useSyncExternalStore } from 'react';
import { useSession } from './use-session';

/** Profile cache entry */
export type ProfileEntry = {
  /** Profile data */
  data: Profile;
  /** Time the entry was updated */
  time: number;
};

/** Member cache */
type ProfileCache = Record<string, ProfileEntry>;

/** Global state */
const _ = {
  /** Profile cache */
  profiles: {} as ProfileCache,
  /** Map of keys that are loading a fetch */
  loading: new Set<string>(),
  /** List of listeners */
  listeners: [] as (() => void)[],
};

/** Subscribe func for external store */
function _subscribe(listener: () => void) {
  _.listeners = [..._.listeners, listener];
  return () => {
    _.listeners = _.listeners.filter((l) => l !== listener);
  };
}

/** Snapshot func for external store */
function _getSnapshot() {
  return _.profiles;
}

/** Function to notify that store changes occurred */
function _emitChange() {
  for (const listener of _.listeners) listener();
}

/** Checks if an entry needs to be fetched */
function _needFetch(
  key: string,
  entry: { time: number } | undefined,
  lifetime: number = config.app.member.cache_lifetime, // reuse member cache lifetime
) {
  return (
    (entry === undefined ||
      entry === null ||
      Date.now() - entry.time >= lifetime * 1000) &&
    (!key || !_.loading.has(key))
  );
}

/** Gets member entry */
function _getProfileEntry(
  profile_id: string,
  cache: ProfileCache = _.profiles,
) {
  return cache[profile_id] as ProfileEntry | undefined;
}

/** Set profiles options */
type SetProfilesOptions = {
  /** If this change should be emitted (default true) */
  emit?: boolean;
  /** Should the `online` property be overridden (default true) */
  override_online?: boolean;
};

/** Set profiles to store */
export function setProfiles(
  profiles: Profile[],
  options?: SetProfilesOptions,
) {
  const now = Date.now();
  const cache = {} as ProfileCache;

  // Set all profiles
  for (const profile of profiles) {
    const newProfile =
      options?.override_online === false && cache[profile.id]
        ? { ...profile, online: cache[profile.id].data.online }
        : profile;
        cache[profile.id] = { data: newProfile, time: now };
  }

  // Update profiles cache
  _.profiles = { ..._.profiles, ...cache };

  // Emit changes
  if (options?.emit !== false) _emitChange();
}


/**
 * Get profile cache. Should be used in a component for it to recieve cache changes.
 *
 * @returns Profile cache
 */
export function useProfileCache() {
  return useSyncExternalStore(_subscribe, _getSnapshot);
}

/** Single profile wrapper */
export type ProfileWrapper<Loaded extends boolean = true> =
  | ({ _exists: true } & Profile)
  | (Loaded extends true
      ? never
      : { _exists: false } & Partial<Profile>);

/**
 * Get a single profile
 *
 * @param profile_id The profile id to retrieve
 * @returns The profile
 */
export function useProfile(profile_id: string | undefined) {
  const session = useSession();
  const profiles = useSyncExternalStore(_subscribe, _getSnapshot);

  return useMemo(() => {
    if (!profile_id) return { _exists: false } as ProfileWrapper<false>;

    const key = profile_id;
    const cached = _getProfileEntry(profile_id);
    const _exists = cached !== undefined;

    // Check if need fetch
    const needFetch = _needFetch(key, cached);
    if (needFetch) {
      _.loading.add(key);

      // Fetch profile and set to store
      api(
        'GET /profiles/:profile_id',
        {
          params: { profile_id },
          query: {},
        },
        { session },
      ).then((profile) => {
        setProfiles([profile]);
        _.loading.delete(key);
      });
    }

    // Return null or existing while refetching
    return { ...cached?.data, _exists } as ProfileWrapper<false>;
  }, [profile_id, profiles]);
}


/** Multi profile wrapper */
export type ProfilesWrapper<Loaded extends boolean = true> =
  | { _exists: true; data: Profile[] }
  | (Loaded extends true ? never : { _exists: false; data?: Profile[] });

/**
 * Get a list of profiles
 *
 * @param profile_ids The profile ids to retrieve
 * @returns The profile
 */
export function useProfiles(profile_ids: string[] | undefined) {
  const session = useSession();
  const profiles = useSyncExternalStore(_subscribe, _getSnapshot);

  return useMemo(() => {
    if (!profile_ids?.length) return { _exists: true, data: [] };

    let needFetch = false;
    let _exists = true;

    // Cache keys
    const keys = profile_ids;

    // Get cached
    const cached: ProfileEntry[] = [];
    for (let i = 0; i < profile_ids.length; ++i) {
      const entry = _getProfileEntry(profile_ids[i]);
      needFetch = needFetch || _needFetch(keys[i], entry);
      _exists = entry !== undefined;

      if (entry) cached.push(entry);
    }

    // Check if need fetch
    if (needFetch) {
      for (const key of keys) _.loading.add(key);

      // Fetch profile and set to store
      api(
        'GET /profiles',
        {
          query: { ids: profile_ids },
        },
        { session },
      ).then((profiles) => {
        assert(Array.isArray(profiles));
        setProfiles(profiles);

        for (const key of keys) _.loading.delete(key);
      });
    }

    // Return null or existing while refetching
    return {
      _exists,
      data: _exists ? cached.map((x) => x.data) : undefined,
    } as ProfilesWrapper<false>;
  }, [profile_ids, profiles]);
}


/**
 * Get a profile from cache, even if the data is stale
 *
 * @param profile_id The profile id
 * @returns The profile object
 */
export function getProfileSync(
  profile_id: string,
): Profile | null {
  return _getProfileEntry(profile_id)?.data || null;
}

/**
 * Update profiles with the given profile id.
 * This function only updates profile values locally
 *
 * @param profile_id The id of the profile
 * @param fn The update function
 * @param emit Indicates if this change should be emitted
 */
export function updateProfileLocal(
  profile_id: string,
  fn: (profile: Profile) => Profile,
  emit: boolean = true,
) {
  // Quit if profile does not exist
  if (!_.profiles[profile_id]) return;

  // Create copy
  const copy = { ..._.profiles };
  copy[profile_id] = { ...copy[profile_id], data: fn(copy[profile_id].data) };

  // Set cache
  _.profiles = copy;

  if (emit) _emitChange();
}


////////////////////////////////////////////////////////////
function mutators(
  mutate: KeyedMutator<ExpandedProfile>,
  session: SessionState | undefined,
) {
  assert(session);

  return {
    /**
     * Create new domain and add user as its first member
     *
     * @param name The name of the domain
     * @returns The new profile object
     */
    addDomain: (name: string, icon?: { file: Blob; name: string }) =>
      mutate(
        swrErrorWrapper(
          async (profile: ExpandedProfile) => {
            // Domain create api
            const domain = await api(
              'POST /domains',
              {
                body: { name },
              },
              { session },
            );

            // Upload icon image if given
            if (icon) {
              const url = await uploadDomainImage(
                domain.id,
                'icon',
                icon.file,
                icon.name,
                session,
              );
              domain.icon = url;
            }

            // Add domain id to profiles
            return {
              ...profile,
              domains: [...profile.domains, domain],
            };
          },
          { message: 'An error occurred while creating domain' },
        ),
        { revalidate: false },
      ),

    /**
     * Add user as a member of the specified domain
     *
     * @param domain_id The domain to join
     * @param alias The alias of the user
     * @returns The new profile object
     */
    joinDomain: (domain_id: string, alias: string) =>
      mutate(
        swrErrorWrapper(
          async (profile: ExpandedProfile) => {
            // Use api to join
            const results = await api(
              'POST /domains/join/:join_id',
              {
                params: { join_id: domain_id },
              },
              { session },
            );

            return {
              ...profile,
              domains: [...profile.domains, results],
            };
          },
          { message: 'An error occurred while joining the domain' },
        ),
        { revalidate: false },
      ),

    /**
     * Upload and set the specified image as the profile picture.
     *
     * @param image The image data to set as profile picture
     * @param fname The name of the original image file
     * @returns The new profile object
     */
    setPicture: (image: Blob, fname: string) =>
      mutate(
        swrErrorWrapper(
          async (profile: ExpandedProfile) => {
            // Upload profile image
            const url = await uploadProfile(profile, image, fname, session);

            // Update member objects
            updateMemberLocal(profile.id, (member) => ({
              ...member,
              profile_picture: url,
            }));

            return {
              ...profile,
              profile_picture: url,
            };
          },
          { message: 'An error occurred while setting profile picture' },
        ),
        { revalidate: false },
      ),

    /**
     * Remove the current profile picture. Performs optimistic update.
     *
     * @param old_profile The old profile object used to rollback optimistic updates on error
     * @returns The new profile picture
     */
    removePicture: (old_profile: ExpandedProfile) =>
      mutate(
        swrErrorWrapper(
          async (profile: ExpandedProfile) => {
            // Delete profile image
            await deleteProfile(profile, session);

            // Update member objects
            updateMemberLocal(profile.id, (member) => ({
              ...member,
              profile_picture: null,
            }));

            return {
              ...profile,
              profile_picture: null,
            };
          },
          { message: 'An error occurred while removing profile picture' },
        ),
        {
          revalidate: false,
          optimisticData: (profile) => {
            assert(profile);
            return {
              ...profile,
              profile_picture: null,
            };
          },
        },
      ),

    /**
     * Upload and set the specified image as the profile banner.
     *
     * @param image The image data to set as profile banner
     * @param fname The name of the original image file
     * @returns The new profile object
     */
    setBanner: (image: Blob, fname: string) =>
      mutate(
        swrErrorWrapper(
          async (profile: ExpandedProfile) => {
            // Generate form data
            const formData = new FormData();
            formData.append('image', image, fname);

            // Upload profile image
            const result = await api(
              'POST /profiles/:profile_id/banner',
              {
                params: { profile_id: profile.id },
                form: formData,
              },
              { session },
            );
            const url = result.banner;

            // Update member objects
            updateMemberLocal(profile.id, (member) => ({
              ...member,
              banner: url,
            }));

            return {
              ...profile,
              banner: url,
            };
          },
          { message: 'An error occurred while setting profile banner' },
        ),
        { revalidate: false },
      ),

    /**
     * Remove the current profile banner. Performs optimistic update.
     *
     * @returns The new profile picture
     */
    removeBanner: () =>
      mutate(
        swrErrorWrapper(
          async (profile: ExpandedProfile) => {
            // Delete profile banner
            await api(
              'DELETE /profiles/:profile_id/banner',
              {
                params: { profile_id: profile.id },
              },
              { session },
            );

            // Update member objects
            updateMemberLocal(profile.id, (member) => ({
              ...member,
              banner: null,
            }));

            return {
              ...profile,
              banner: null,
            };
          },
          { message: 'An error occurred while removing profile banner' },
        ),
        {
          revalidate: false,
          optimisticData: (profile) => {
            assert(profile);
            return {
              ...profile,
              banner: null,
            };
          },
        },
      ),
  };
}

/** Mutators that will be attached to the profile swr wrapper */
export type CurrentProfileMutators = ReturnType<typeof mutators>;
/** Swr data wrapper for a profile object */
export type CurrentProfileWrapper<Loaded extends boolean = true> = SwrWrapper<
  ExpandedProfile,
  Loaded,
  CurrentProfileMutators
>;

/** Default value for domain */
let _defaults: Record<string, ExpandedProfile> = {};

/** Get domain swr key */
export function setProfileDefault(profile: ExpandedProfile) {
  _defaults[profile.id] = profile;
}

/**
 * A swr hook that retrieves the current profile.
 *
 * @returns A swr wrapper object containing the current profile
 */
export function useCurrentProfile() {
  const session = useSession();

  return useApiQuery(
    session.profile_id,
    'GET /profiles/:profile_id',
    {
      params: { profile_id: session.profile_id },
      query: { with_domains: true },
    },
    {
      then: (result) => {
        // Reset default
        if (_defaults[session.profile_id]) delete _defaults[session.profile_id];

        return result as ExpandedProfile;
      },
      mutators,
      initial: _defaults[session.profile_id],
    },
  );
}
