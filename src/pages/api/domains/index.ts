import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter, expressWrapper } from 'next-connect';
import assert from 'assert';

import _config from '@/config';
import { AccessToken, AclEntry, Channel, ChannelGroup, Domain, Member, Role } from '@/lib/types';
import { query, sql } from '@/lib/db';

import { token } from '@/lib/utility/authenticate';


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

			// Templates
			const templates = {
				default: () => ([
					sql.let('$groups', '[]'),
					sql.let('$group', sql.create<ChannelGroup>('channel_groups', {
						domain: sql.$('$domain.id'),
						name: 'Main',
						channels: sql.$('[]'),
					})),
					sql.update<ChannelGroup>('($group.id)', {
						set: {
							channels: sql.$('[' + sql.wrap(
								sql.create<Channel>('channels', {
									domain: sql.$('$domain.id'),
									inherit: sql.$('$group.id'),
									name: 'general',
									type: 'text',
								}),
								{ append: '.id' }
							) + ']'),
						},
					}),
					sql.create<AclEntry>('acl', {
						domain: sql.$('$domain.id'),
						resource: sql.$('$group.id'),
						role: sql.$('$role.id'),
						permissions: [
							'can_view',
							'can_send_messages',
							'can_send_attachments',
							'can_broadcast_audio',
							'can_broadcast_video',
						],
					}),
					sql.let('$groups', `array::append($groups, $group.id)`),
				]),
			};

			// Create new domain with the specified name and make user join
			const results = await query<Domain[]>(sql.transaction([
				// Create domain
				sql.let('$domain', sql.create<Domain>('domains', {
					name: params.name,
					groups: [],
				})),
				// Create everyone role
				sql.let('$role', sql.create<Role>('roles', {
					domain: sql.$('$domain.id'),
					label: 'everyone',
				})),
				// Create starting template configuration
				...templates.default(),
				// Add starting config to domain
				sql.let('$domain', sql.update<Domain>('$domain', {
					set: {
						_default_role: sql.$('$role.id'),
						groups: sql.$('$groups'),
					},
				})),
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