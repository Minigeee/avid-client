import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter, expressWrapper } from 'next-connect';
import assert from 'assert';

import _config from '@/config';
import { AccessToken } from '@/lib/types';
import { profiles, query, sql } from '@/lib/db';

import { refresh, token } from '@/lib/utility/authenticate';


const router = createRouter<NextApiRequest & { token: AccessToken }, NextApiResponse>();

router
	.use(token)

	// POST
	.post(
		async (req, res) => {
			const params = req.body as {
				username: string;
			};

			// TODO : Check if user can create new profile
			const id = await profiles.create(req.token.user_id, params.username, true);
			
			// Refresh session
			const token = await refresh(req, res);

			res.status(200).json({ token, profile_id: id });
		}
	)

export const config = {
	api: {
		bodyParser: true,
	}
}

export default router.handler({
	onError: (err: any, req, res) => {
		console.error(err.stack);
		res.status(err.statusCode || 500).end(err.message);
	},
});