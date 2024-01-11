import { id } from '@/lib/db';
import { SessionState } from '@/lib/contexts';
import {
  Attachment,
  ExpandedAttachment,
  ExpandedDomain,
  ExpandedProfile,
  FileAttachment,
} from '@/lib/types';

import axios from 'axios';
import { api, withAccessToken } from './utility';

/**
 * Upload a profile image
 *
 * @param profile The profile to upload image for
 * @param image The image to upload
 * @param fname The original image file name
 * @param session Session used to authenticate request
 * @returns The url of the uploaded image
 */
export async function uploadProfile(
  profile: ExpandedProfile,
  image: Blob,
  fname: string,
  session: SessionState,
) {
  // Generate form data
  const formData = new FormData();
  formData.append('image', image, fname);

  // Send image post
  const results = await axios.post<{ image: string }>(
    `/api/upload/profile/${id(profile.id)}`,
    formData,
    withAccessToken(session),
  );

  return results.data.image;
}

/**
 * Delete a profile image
 *
 * @param profile The profile to delete an image from
 * @param session Session used to authenticate request
 */
export async function deleteProfile(
  profile: ExpandedProfile,
  session: SessionState,
) {
  // Send delete request
  await axios.delete(
    `/api/upload/profile/${id(profile.id)}`,
    withAccessToken(session),
  );
}

/**
 * Upload a domain image
 *
 * @param domain_id The id of the domain to upload image for
 * @param type The type of image being uploaded
 * @param image The image to upload
 * @param fname The original image file name
 * @param session Session used to authenticate request
 * @returns The url of the uploaded image
 */
export async function uploadDomainImage(
  domain_id: string,
  type: 'icon' | 'banner',
  image: Blob,
  fname: string,
  session: SessionState,
) {
  // Generate form data
  const formData = new FormData();
  formData.append('image', image, fname);

  // Send image post
  const results = await axios.post<{ image: string }>(
    `/api/upload/domains/${id(domain_id)}/${type}`,
    formData,
    withAccessToken(session),
  );

  return results.data.image;
}

/**
 * Delete a profile image
 *
 * @param domain The domain to delete an image from
 * @param type The type of image to delete
 * @param session Session used to authenticate request
 */
export async function deleteDomainImage(
  domain: ExpandedDomain,
  type: 'icon' | 'banner',
  session: SessionState,
) {
  // Send delete request
  await axios.delete(
    `/api/upload/domains/${id(domain.id)}/${type}`,
    withAccessToken(session),
  );
}

/**
 * Upload message attachments
 *
 * @param domain_id The domain under which the attachment is being uploaded
 * @param files The files to upload
 * @param session Session used to authenticate request
 * @returns The urls of the uploaded files, and their dimensions if the file is an image
 */
export async function uploadAttachments(
  domain_id: string,
  files: FileAttachment[],
  session: SessionState,
): Promise<ExpandedAttachment[]> {
  // Generate form data
  const formData = new FormData();
  for (const f of files) formData.append('files', f.file, f.file.name);
  formData.set(
    'attachments',
    JSON.stringify(files.map((f) => ({ ...f, file: undefined }))),
  );

  // Send image post
  const results = await api(
    'POST /attachments/:domain_id',
    {
      params: { domain_id },
      form: formData,
    },
    { session }
  );

  return results;
}
