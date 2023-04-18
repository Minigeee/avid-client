import { NextApiRequest, NextApiResponse } from 'next';

import { authenticate, signin } from '@/lib/utility/authenticate';


////////////////////////////////////////////////////////////
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'GET') {
		res.status(404).end();
		return;
	}

	// Get user
	const user = await authenticate('google', { failureRedirect: '/fail' }, req, res);

	// Complete sign in
	await signin(user, res);
}