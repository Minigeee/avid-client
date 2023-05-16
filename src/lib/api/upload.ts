import { id } from '@/lib/db';
import { SessionState } from '@/lib/contexts';
import { ExpandedProfile } from '@/lib/types';

import axios from 'axios';
import { withAccessToken } from './utility';


/**
 * Upload a profile image
 * 
 * @param profile The profile to upload image for
 * @param image The image to upload
 * @param fname The original image file name
 * @param session Session used to authenticate request
 * @returns The url of the uploaded image
 */
export async function uploadProfile(profile: ExpandedProfile, image: Blob, fname: string, session: SessionState) {
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
export async function deleteProfile(profile: ExpandedProfile, session: SessionState) {
	// Send delete request
	await axios.delete(`/api/upload/profile/${id(profile.id)}`, withAccessToken(session));
}


/** Attachment info returned with the `uploadAttachment()` function */
export type AttachmentInfo = {
	/** The url location of the attachment */
	url: string;
	/** The width of the attachment if it is an image */
	width?: number;
	/** The height of the attachment if it is an image */
	height?: number;
};

/** Get dimensions of image file */
async function _getImageDims(f: File): Promise<{ width: number; height: number }> {
	return new Promise(res => {
		const fr = new FileReader;

		fr.onload = function () { // file is loaded
			const img = new Image;

			img.onload = function () {
				res({ width: img.width, height: img.height });
			};

			if (typeof fr.result === 'string')
				img.src = fr.result; // is the data URL because called with readAsDataURL
		};

		fr.readAsDataURL(f);
	});
}

/**
 * Upload message attachments
 * 
 * @param domain_id The domain under which the attachment is being uploaded
 * @param files The files to upload
 * @param session Session used to authenticate request
 * @returns The urls of the uploaded files, and their dimensions if the file is an image
 */
export async function uploadAttachments(domain_id: string, files: File[], session: SessionState) {
	// Generate form data
	const formData = new FormData();
	for (const f of files)
		formData.append('attachments', f, f.name);

	// Get image dimensions
	const dims: { width?: number; height?: number }[] = [];
	for (const f of files) {
		if (f.type.startsWith('image'))
			dims.push(await _getImageDims(f));
		else
			dims.push({});
	}

	// Send image post
	const results = await axios.post<{ urls: string[] }>(
		`/api/upload/attachment/${id(domain_id)}`,
		formData,
		withAccessToken(session),
	);

	return results.data.urls.map((url, i) => ({
		url,
		...dims[i],
	}));
}