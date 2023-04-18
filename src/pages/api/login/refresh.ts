import { NextApiRequest, NextApiResponse } from 'next';

import { refresh } from '@/lib/utility/authenticate';


////////////////////////////////////////////////////////////
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'POST') {
		res.status(404).end();
		return;
	}

	// Create new access token
	const token = await refresh(req, res);

	// Send the access token
	if (token)
		res.status(200).json({ token });
}