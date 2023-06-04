import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter, expressWrapper } from 'next-connect';
import assert from 'assert';

import _config from '@/config';
import { Domain } from '@/lib/types';
import { query, record, sql } from '@/lib/db';
import { s3, upload } from '@/lib/utility/spaces';
import { getImageKey, getImageUrl } from '@/lib/utility/spaces-util';

import { uid } from 'uid';


const router = createRouter<NextApiRequest & { image: string }, NextApiResponse>();

router
	// POST
	.post(
		// Image uploader
		// @ts-ignore
		expressWrapper(upload((req: Express.Request<>, file) => {
			// Generate key
			const id = uid();
			const domain_id = req.query.domain_id as string;
			const ext = file.originalname.split('.').at(-1);
			const key = `images/domains/${domain_id}/icon-${id}.${ext}`;

			// Set image url
			req.image = getImageUrl(key);

			return key;
		}, { fileSize: _config.upload.profile_picture.max_size }).single('image')),

		async (req, res) => {
			// Update domain
			const domain_id = record('domains', req.query.domain_id as string);
			const results = await query<Domain[]>(sql.update<Domain>(domain_id, {
				content: { icon: req.image },
				return: 'BEFORE',
			}));
			assert(results && results.length > 0);

			// Delete old image
			if (results[0].icon)
				s3.delete(getImageKey(results[0].icon));

			// Send new image url
			res.json({ image: req.image });
		}
	)
	
	// DELETE
	.delete(async (req, res) => {
		// Update domain
		const domains_id = record('domains', req.query.domain_id as string);
		const results = await query<Domain[]>(sql.update<Domain>(domains_id, {
			content: { icon: null },
			return: 'BEFORE',
		}));
		assert(results && results.length > 0);

		// Delete old image
		if (results[0].icon)
			s3.delete(getImageKey(results[0].icon));

		res.end();
	});

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