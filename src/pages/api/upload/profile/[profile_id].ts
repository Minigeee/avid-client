import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter, expressWrapper } from 'next-connect';
import assert from 'assert';

import { Profile } from '@/lib/types';
import { query, record, sql } from '@/lib/db';
import { getImageKey, getImageUrl, s3, upload } from '@/lib/utility/spaces';

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
			const profile_id = req.query.profile_id as string;
			const ext = file.originalname.split('.').at(-1);
			const key = `images/profiles/${profile_id}/${id}.${ext}`;

			// Set image url
			req.image = getImageUrl(key);

			return key;
		}).single('image')),

		async (req, res) => {
			// Update profile
			const profile_id = record('profiles', req.query.profile_id as string);
			const results = await query<Profile[]>(sql.update<Profile>(profile_id, {
				content: { profile_picture: req.image },
				return: 'BEFORE',
			}));
			assert(results && results.length > 0);

			// Delete old image
			if (results[0].profile_picture)
				s3.delete(getImageKey(results[0].profile_picture));

			// Send new image url
			res.json({ image: req.image });
		}
	)
	
	// DELETE
	.delete(async (req, res) => {
		// Update profile
		const profile_id = record('profiles', req.query.profile_id as string);
		const results = await query<Profile[]>(sql.update<Profile>(profile_id, {
			content: { profile_picture: null },
			return: 'BEFORE',
		}));
		assert(results && results.length > 0);

		// Delete old image
		if (results[0].profile_picture)
			s3.delete(getImageKey(results[0].profile_picture));

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