import { NextApiRequest, NextApiResponse } from 'next';

import config from '@/config';
import { authenticate, signin } from '@/lib/utility/authenticate';


////////////////////////////////////////////////////////////
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'GET') {
		res.status(404).end();
		return;
	}

	// Get user
	const user = await authenticate('google', { failureRedirect: '/fail' }, req, res);

	try {
		// Complete sign in
		await signin(user, res, req.query.state as string | undefined);
	}
	catch (err) {
		res.status(500).end();
	}
}