import { NextApiRequest, NextApiResponse } from 'next';

import { authenticate, initialize } from '@/lib/utility/authenticate';

// Initialize passport
initialize();


////////////////////////////////////////////////////////////
export default function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'GET') {
		res.status(404).end();
		return;
	}

	// Log in using provider
	if (req.query.provider) {
		// Different actions based on provider
		if (req.query.provider === 'google') {
			authenticate('google', {
				scope: ['email', 'profile'],
			}, req, res);
		}
	}
}