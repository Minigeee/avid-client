import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter, expressWrapper } from 'next-connect';
import assert from 'assert';

import _config from '@/config';
import { id } from '@/lib/db';
import { token } from '@/lib/utility/authenticate';
import { getImageUrl, getResourceUrl, upload } from '@/lib/utility/spaces';


const router = createRouter<NextApiRequest & { url: string }, NextApiResponse>();

router
	.use(token)

	// POST
	.post(
		// Image uploader
		// @ts-ignore
		expressWrapper(upload((req: Express.Request<>, file) => {
			const isImage = file.mimetype.startsWith('image');

			// Generate key
			const prefix = isImage ? 'images/' : '';
			const domain_id = req.query.domain_id as string;
			const profile_id = req.token.profile_id;
			const key = `${prefix}attachments/${domain_id}/${id(profile_id)}/${file.originalname}`;

			// Set image url
			req.url = isImage ? getImageUrl(key) : getResourceUrl(key);

			return key;
		}, { fileSize: _config.upload.attachment.max_size }).single('attachment')),

		async (req, res) => {
			// Send resource url
			res.json({ url: req.url });
		}
	);

export const config = {
	api: {
		bodyParser: false,
	}
}

export default router.handler({
	onError: (err: any, req, res) => {
		console.error(err.stack);
		res.status(err.statusCode || 500).end(err.message);
	},
});