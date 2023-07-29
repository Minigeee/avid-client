import { ChannelTypes } from './channel';


// Only admin can change domain permissions object

export type DomainPermissions =
	/** Roles that can manage domain settings */
	'can_manage' |
	/** Roles that can manage invites to domain */
	'can_manage_invites' |
	/** Roles that can create extensions */
	'can_manage_extensions' |
	/** Roles that can create domain level channel groups */
	'can_create_groups' |
	/** Roles that can create domain level roles */
	'can_create_roles';


export type RolePermissions =
	/** Roles that can manage role (name, badge, permissions if they are manager to the resource, and managers if user is a manager to the role being assigned as managee) */
	'can_manage' |
	/** Allows users to manage the permissions of this role for resources the user can manage */
	'can_manage_permissions' |
	/** Allows users to delete the role */
	'can_delete_role' |
	/** Roles that can assign (and unassign) this role */
	'can_assign_role';
	
/** Member related permissions, but resource id = all of member's roles */
export type MemberPermissions =
	/** Roles that can manage alias of members with a given role */
	'can_manage_member_alias' |
	/** Roles that can manage all roles of members with a given role */
	'can_manage_member_roles' |
	/** Roles that can kick members with a given role */
	'can_kick_member' |
	/** Roles that can ban members with a given role */
	'can_ban_member';


/** General channel permissions, all fields are a list of roles that have access to the specified permission */
export type ChannelPermissions =
	/** Roles that can view channel */
	'can_view' |
	/** Roles that can manage channel (change settings, etc.) */
	'can_manage' |
	/** Allows role to delete channel group */
	'can_delete_group' |
	/** Roles that can create and delete channel group resources */
	'can_manage_resources';

/** Text channel permissions */
export type TextChannelPermissions =
	/** Roles that can send messages */
	'can_send_messages' |
	/** Roles that can send attachments */
	'can_send_attachments' |
	/** Allows role to send reactions */
	'can_send_reactions' |
	/** Roles that can delete and manage others' messages (pin, remove reactions, etc.) */
	'can_manage_messages';

/** Board related permissions */
export type BoardPermissions =
	/** Roles that can view board */
	'can_view' |
	/** Roles that can manage board (change settings, tags, etc.) */
	'can_manage' |
	/** Roles that can create + manage tasks within board, regardless of assignee (summary, details, assignee, etc.) */
	'can_manage_tasks' |
	/** Roles that can create + manage their own tasks within board (those tasks assigned to them) */
	'can_manage_own_tasks';

/** Rtc permissions */
export type RtcChannelPermissions =
	/** Roles that can speak in this channel */
	'can_broadcast_audio' |
	/** Roles that can share video (webcam, screenshare) in this channel */
	'can_broadcast_video' |
	/** Roles that can manage other members within this channel (all actions wrapped into this: mute, deafen, stop sharing, move, kick, ban) */
	'can_manage_participants';

/** All channel permissions */
export type AllChannelPermissions = ChannelPermissions | TextChannelPermissions | BoardPermissions | RtcChannelPermissions;


/** All permissions types */
export type AllPermissions = DomainPermissions | RolePermissions | MemberPermissions | AllChannelPermissions;


/** Access control list entry */
export type AclEntry = {
	/** The id of the domain the protected resource is contained in */
	domain: string;
	/** The id of the protected resource */
	resource: string;
	/** The id of the role that permissions are defined for */
	role: string;
	/** List of permissions */
	permissions: AllPermissions[];
};