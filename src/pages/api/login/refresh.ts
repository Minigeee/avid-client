import { NextApiRequest, NextApiResponse } from 'next';

import { refresh } from '@/lib/utility/authenticate';


////////////////////////////////////////////////////////////
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'POST') {
		res.status(404).end();
		return;
	}

	// Create new access token
	const result = await refresh(req, res);

	// Send the access token
	if (result)
		res.status(200).json({ token: result[0] });
}