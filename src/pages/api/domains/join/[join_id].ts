import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter, expressWrapper } from 'next-connect';
import assert from 'assert';

import _config from '@/config';
import { Channel, Domain, Member, Role } from '@/lib/types';
import { query, sql } from '@/lib/db';

import { AccessToken, token } from '@/lib/utility/authenticate';


const router = createRouter<NextApiRequest & { token: AccessToken }, NextApiResponse>();

router
	.use(token)

	// GET
	.get(
		async (req, res) => {
			const domain_id = `domains:${req.query.join_id}`;

			// Create new domain with the specified name and make user join
			const results = await query<(Domain & { members: string })[]>(sql.multi([
				sql.select<Domain>([
					'name',
					'icon',
					sql.wrap(`<-(member_of WHERE in = ${req.token.profile_id})`, { alias: 'members' })
				], {
					from: domain_id,
				}),
			]));
			assert(results);

			// Send new image url
			if (!results.length)
				res.status(404).end();
			else
				res.json({ name: results[0].name, icon: results[0].icon, is_member: results[0].members.length > 0 });
		}
	)

	// POST
	.post(
		async (req, res) => {
			const domain_id = `domains:${req.query.join_id}`;

			// Try adding member
			const results = await query<Domain[]>(sql.multi([
				sql.let('$domain', sql.select<Domain>(['id', 'name', 'icon', '_default_role'], { from: domain_id })),
				sql.relate<Member>(req.token.profile_id, 'member_of', '$domain', {
					content: {
						alias: sql.$(`${req.token.profile_id}.username`),
						roles: [sql.$('$domain._default_role')],
					}
				}),
				sql.select('*', { from: '$domain' }),
			]));
			assert(results && results.length > 0);

			res.json(results[0]);
		}
	);

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