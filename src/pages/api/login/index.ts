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

  // State
  const state = {
    redirect: req.query.redirect,
    alpha_key: req.query.alpha_key,
  };
  const stateStr = Buffer.from(JSON.stringify(state)).toString('base64');

  // Log in using provider
  if (req.query.provider) {
    // Different actions based on provider
    if (req.query.provider === 'google') {
      authenticate(
        'google',
        {
          scope: ['email', 'profile'],
          state: stateStr,
        },
        req,
        res,
      );
    }
  }
}
