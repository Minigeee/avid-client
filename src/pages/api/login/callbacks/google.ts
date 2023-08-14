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
	console.log('preauth')
	const user = await authenticate('google', { failureRedirect: '/fail' }, req, res);
	console.log('postauth')

	try {
		// Complete sign in
		const stateStr = typeof req.query.state === 'string' ? Buffer.from(req.query.state, 'base64').toString() : undefined;
		const state = stateStr ? JSON.parse(stateStr) as { redirect?: string; alpha_key?: string } : undefined
		console.log('preuser')
		await signin(user, res, state?.redirect, state?.alpha_key || '');
		console.log('postuser')
	}
	catch (err) {
		res.status(500).end();
	}
}