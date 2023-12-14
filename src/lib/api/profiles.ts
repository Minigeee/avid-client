import { id } from '@/lib/db';
import { SessionState } from '@/lib/contexts';
import {
  Attachment,
  ExpandedDomain,
  ExpandedProfile,
  FileAttachment,
} from '@/lib/types';

import axios from 'axios';
import { withAccessToken } from './utility';

/**
 * Create a new profile
 *
 * @param username The username to give the profile
 * @param session The session object used to authenticate request
 * @returns The id of the new profile
 */
export async function createProfile(username: string, session: SessionState) {
  // Send image post
  const results = await axios.post<{ token: string; profile_id: string }>(
    `/api/profiles`,
    { username },
    withAccessToken(session),
  );

  // Apply token
  session._mutators.applyToken(results.data.token);

  return results.data.profile_id;
}
