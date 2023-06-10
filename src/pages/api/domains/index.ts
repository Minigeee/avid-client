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

	// POST
	.post(
		async (req, res) => {
			const params = req.body as {
				name: string;
			};

			// TODO : Check if user can create new domain

			// Create new domain with the specified name and make user join
			const results = await query<Domain[]>(sql.transaction([
				// TODO : Create default channels where each channel type is handled correctly
				sql.let('$channels', '[]'),
				// Create domain
				sql.let('$domain', sql.create<Domain>('domains', {
					name: params.name,
					channels: sql.fn<Domain>('add_domain', function (channels: Channel[]) {
						return channels.map(x => x.id);
					}),
				})),
				// Create everyone role
				sql.let('$role', sql.create<Role>('roles', {
					domain: sql.$('$domain.id'),
					label: 'everyone',
				})),
				// Add everyone role to domain
				sql.let('$domain', sql.update<Domain>('$domain', { set: { _default_role: sql.$('$role.id') } })),
				// Add member to domain as owner/admin
				sql.relate<Member>(req.token.profile_id, 'member_of', '$domain', {
					content: {
						alias: sql.$(`${req.token.profile_id}.username`),
						roles: [sql.$('$role.id')],
						is_owner: true,
						is_admin: true,
					},
				}),
				// Return id of domain
				sql.return('$domain'),
			]));
			assert(results && results.length > 0);

			// Send new image url
			res.json({ domain: results[0] });
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