import { ChannelTypes } from './channel';


// Only admin can change domain permissions object

export type DomainPermissions =
	/** Roles that can manage domain settings */
	'can_manage' |
	/** Roles that can create members of domain (create invites) */
	'can_create_members' |
	/** Roles that can create channels (will become a channel group permission later) */
	'can_create_channels' |
	/** Roles that can create (non-channel) resources */
	'can_create_resources' |
	/** Roles that can create extensions */
	'can_create_extensions' |
	/** Roles that can create domain level roles */
	'can_create_roles';


export type RolePermissions =
	/** Roles that can manage role (all settings excluding permissions) */
	'can_manage' |
	/** Roles that can manage role's permissions (can't set permissions that exceed own permissions) */
	'can_manage_permissions' |
	/** Roles that can create subroles (this may or may not include self) */
	'can_create_subroles' |
	/** Roles that can assign (and unassign) this role */
	'can_assign_role';
	
/** Member related permissions, but resource id = all of member's roles */
export type MemberPermissions =
	/** Roles that can manage alias of members with a given role */
	'can_manage_alias' |
	/** Roles that can manage all roles of members with a given role */
	'can_manage_roles' |
	/** Roles that can kick members with a given role */
	'can_kick' |
	/** Roles that can ban members with a given role */
	'can_ban';


/** General channel permissions, all fields are a list of roles that have access to the specified permission */
export type ChannelPermissions =
	/** Roles that can view channel */
	'can_view' |
	/** Roles that can manage channel (change settings, etc.) */
	'can_manage' |
	/** Roles that can manage channel permissions (overrides) */
	'can_manage_permissions';

/** Text channel permissions */
export type TextChannelPermissions =
	/** Roles that can send messages */
	'can_send_messages' |
	/** Roles that can send attachments */
	'can_send_attachments' |
	/** Roles that can delete others' messages */
	'can_delete_messages';

/** Board related permissions */
export type BoardPermissions =
	/** Roles that can view board */
	'can_view' |
	/** Roles that can manage board (change settings, tags, etc.) */
	'can_manage' |
	/** Roles that can manage board permissions (overrides) */
	'can_manage_permissions' |
	/** Roles that can create + manage tasks within board, regardless of assignee (summary, details, assignee, etc.) */
	'can_manage_tasks' |
	/** Roles that can create + manage their own tasks within board (those tasks assigned to them) */
	'can_manage_own_tasks';

/** Rtc permissions */
export type RtcChannelPermissions =
	/** Roles that can speak in this channel */
	'can_speak' |
	/** Roles that can share video (webcam, screenshare) in this channel */
	'can_share_video' |
	/** Roles that can manage other members within this channel (all actions wrapped into this: mute, deafen, stop sharing, move, kick, ban) */
	'can_manage_members';

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