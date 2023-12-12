import { RemoteAppState } from './app_state';
import { Attachment } from './attachment';
import { Board, TaskCollection } from './board';
import { CalendarEvent } from './calendar';
import { Channel, ChannelData, ChannelGroup, ChannelOptions, ChannelTypes } from './channel';
import { Label } from './common';
import { Domain, ExpandedDomain } from './domain';
import { ExpandedMember, Member } from './member';
import { AggregatedReaction, ExpandedMessage, Message } from './message';
import { AclEntry } from './permissions';
import { ExpandedProfile, Profile } from './profile';
import { Role } from './role';
import { ExpandedTask, Task, TaskPriority } from './task';
import { Thread } from './thread';
import { NoId, WithId } from './util';


/** Blueprint for api schema object */
export type ApiSchemaTemplate = Partial<{
	params: string[];
	query: Record<string, any>;
	body: any;
	return: any;
}>;

/** All api paths */
export type ApiPath = keyof ApiSchema;

/** Extracts all api route options, including parameters, query, and body */
export type ApiRouteOptions<P extends ApiPath> =
	(ApiSchema[P] extends { params: string[] } ? Record<ApiSchema[P]['params'][number], string> : {}) &
	(ApiSchema[P] extends { query: any } ? ApiSchema[P]['query'] : {}) &
	(ApiSchema[P] extends { body: any } ? ApiSchema[P]['body'] : {});

/** Api path return value */
export type ApiReturn<Path extends ApiPath> = ApiSchema[Path] extends { return: any } ? ApiSchema[Path]['return'] : null;


/** Message recieved from api */
export type RawMessage = Omit<Message, 'reply_to'> & { reactions?: AggregatedReaction[]; reply_to?: Message };

/** Task object used for api body values */
type Api_Task = Omit<Task, 'id' | 'sid' | 'board' | 'time_created' | 'time_updated' | 'time_status_updated' | 'status'> & { status?: string };

	

/** All api paths and their schemas */
export type ApiSchema = {

	/** App state */
	'GET /app': {
		return: Partial<RemoteAppState> | null;
	},


	/** Boards */
	'GET /boards/:board_id': {
		params: ['board_id'],
		return: Board,
	},
	
	'PATCH /boards/:board_id': {
		params: ['board_id'],
		body: {
			prefix: string;
		},
		return: { prefix: string },
	},

	'POST /boards/:board_id/collections': {
		params: ['board_id'],
		body: NoId<TaskCollection>,
		return: { collections: TaskCollection[]; _id_counter: number },
	},

	'PATCH /boards/:board_id/collections/:collection_id': {
		params: ['board_id', 'collection_id'],
		body: Partial<NoId<TaskCollection>>,
		return: { collections: TaskCollection[] },
	},

	'DELETE /boards/:board_id/collections/:collection_id': {
		params: ['board_id', 'collection_id'],
		return: {
			collections: TaskCollection[];
			tasks_changed: string[];
		},
	},

	'PATCH /boards/:board_id/tags': {
		params: ['board_id'],
		body: {
			add?: Label[];
			update?: WithId<Partial<Label>>[];
		},
		return: { tags: WithId<Label>[]; _id_counter: number },
	},


	/** Calendar events */
	'GET /calendar_events': {
		query: {
			channel: string;
			from?: Date;
			to?: Date;
		},
		return: CalendarEvent[];
	},
	
	'POST /calendar_events': {
		body: Omit<CalendarEvent, 'time_created' | 'id'>,
		return: CalendarEvent;
	},

	'GET /calendar_events/:event_id': {
		params: ['event_id'],
		return: CalendarEvent | null;
	},

	'PATCH /calendar_events/:event_id': {
		params: ['event_id'],
		body: Partial<Omit<CalendarEvent, 'time_created' | 'channel' | 'id'>>,
		return: CalendarEvent;
	},

	'DELETE /calendar_events/:event_id': {
		params: ['event_id'],
	},


	/** Channel groups */
	'GET /channel_groups': {
		query: {
			domain: string;
		},
		return: ChannelGroup[];
	},

	'POST /channel_groups': {
		body: {
			domain: string;
			name?: string;
			allow_everyone?: boolean;
		},
		return: ChannelGroup,
	},

	'PATCH /channel_groups/:group_id': {
		params: ['group_id'],
		body: {
			name?: string;
			/** The group to place this group after */
			after?: string | null;
		},
		return: ChannelGroup | null,
	},

	'DELETE /channel_groups/:group_id': {
		params: ['group_id'],
	},


	/** Channels */
	'GET /channels': {
		query: {
			domain: string;
		},
		return: Channel[];
	},

	'POST /channels': {
		body: {
			domain: string;
			group: string;
			name?: string;
			type: ChannelTypes;
			data?: ChannelData<ChannelTypes>;
			options?: ChannelOptions<ChannelTypes>;
		},
		return: Channel,
	},

	'GET /channels/:channel_id': {
		params: ['channel_id'],
		return: Channel;
	},

	'PATCH /channels/:channel_id': {
		params: ['channel_id'],
		body: {
			name?: string;
			/** The group to move this channel to */
			group?: string;
			/** The channel to place this channel after */
			after?: string | null;
		},
		return: Channel | null,
	},

	'DELETE /channels/:channel_id': {
		params: ['channel_id'],
	},


	/** Domains */

	// TODO : Move domain creation to api
	'POST /domains': {
		body: {
			name: string;
		},
		return: Domain;
	},

	'GET /domains/:domain_id': {
		params: ['domain_id'],
		return: ExpandedDomain;
	},

	'PATCH /domains/:domain_id': {
		params: ['domain_id'],
		body: {
			name?: string;
		},
		return: { name: string };
	},

	'PUT /domains/:domain_id/role_order': {
		params: ['domain_id'],
		body: {
			roles: string[];
		},
		return: { roles: string[] };
	},

	'GET /domains/join/:join_id': {
		params: ['join_id'],
		return: { name: string; icon?: string | null; is_member: boolean };
	},

	'POST /domains/join/:join_id': {
		params: ['join_id'],
		return: Domain;
	},


	/** Members */
	'GET /members': {
		query: {
			domain: string;
			ids?: string[];
			page?: number;
			limit?: number;
			search?: string;
			role?: string;
			exclude_role?: string;
			online?: boolean;
			with_data?: boolean;
		},
		return: ExpandedMember[] | { data: ExpandedMember[]; count: number };
	},

	// TODO : Member add

	'GET /members/:member_id': {
		params: ['member_id'],
		query: {
			domain: string;
		},
		return: ExpandedMember,
	},

	'DELETE /members/:member_id': {
		params: ['member_id'],
		query: {
			domain: string;
		},
	},

	'PATCH /members/:member_id/roles': {
		params: ['member_id'],
		query: {
			domain: string;
		},
		body: {
			roles: string[];
		},
		return: string[];
	},

	'DELETE /members/:member_id/roles/:role_id': {
		params: ['member_id', 'role_id'],
		query: {
			domain: string;
		},
		return: string[];
	},


	/** Messages */
	'GET /messages': {
		query: {
			channel: string;
			thread?: string;
			pinned?: boolean;
			page?: number;
			limit?: number;
		},
		return: {
			messages: RawMessage[];
			members: Record<string, ExpandedMember>;
			threads: Record<string, Thread>;
		},
	},

	'POST /messages': {
		body: {
			channel: string;
			message: string;
			attachments?: Attachment[];
			reply_to?: string;
			thread?: string;
		},
		return: RawMessage,
	},

	'PATCH /messages/:message_id': {
		params: ['message_id'],
		body: {
			message?: string;
			pinned?: boolean;
		},
		return: { message: string },
	},

	'DELETE /messages/:message_id': {
		params: ['message_id'],
	},


	/** Permissions */
	'GET /permissions': {
		query: {
			domain?: string;
			resource?: string;
			resource_type?: string;
			role?: string;
		};
		return: AclEntry[];
	},

	'PATCH /permissions': {
		body: {
			domain: string;
			permissions: Omit<AclEntry, 'id' | 'domain'>[];
		};
		return: {
			updated: AclEntry[];
			deleted: AclEntry[];
		};
	},


	/** Profiles */
	'GET /profiles/:profile_id': {
		params: ['profile_id'],
		return: ExpandedProfile;
	},


	/** Reactions */
	'POST /reactions': {
		body: {
			message: string;
			emoji: string;
		};
	},

	'DELETE /reactions': {
		query: {
			message: string;
			member?: string;
			emoji?: string;
		},
	},

	
	/** Roles */
	'GET /roles': {
		query: {
			domain: string;
		},
		return: Role[];
	},

	'POST /roles': {
		body: {
			domain: string;
			label?: string;
		},
		return: Role,
	},

	'PATCH /roles': {
		body: {
			roles: Partial<Role>[];
		},
		return: Role[],
	},

	'PATCH /roles/:role_id': {
		params: ['role_id'],
		body: {
			label?: string;
			badge?: string | null;
			show_badge?: boolean;
			/** Move role to position after this role */
			after?: string | null;
		},
		return: { role?: Role; order?: string[] },
	},

	'DELETE /roles/:role_id': {
		params: ['role_id'],
	},

	'PATCH /roles/:role_id/members': {
		params: ['role_id'],
		body: {
			members: string[],
		},
		return: ExpandedMember[];
	},
	
	'DELETE /roles/:role_id/members/:member_id': {
		params: ['role_id', 'member_id'],
		return: string[];
	},


	/** Tasks */
	'GET /tasks': {
		query: {
			board: string;
		},
		return: {
			tasks: Task[];
			members: Record<string, ExpandedMember>;
		};
	},

	'POST /tasks': {
		body: Api_Task & {
			board: string;
		},
		return: Task;
	},

	'PATCH /tasks': {
		body: {
			update?: (Partial<Api_Task> & { id: string })[],
			delete?: string[],
		},
		return: { updated?: Task[] };
	},

	'GET /tasks/:task_id': {
		params: ['task_id'],
		return: ExpandedTask;
	},

	'PATCH /tasks/:task_id': {
		params: ['task_id'],
		body: Partial<Api_Task>,
		return: Task;
	},

	'DELETE /tasks/:task_id': {
		params: ['task_id'],
	},


	/** Threads */
	'GET /threads': {
		query: {
			channel: string;
			ids?: string[];
			page?: number;
			limit?: number;
		},
		return: Thread[],
	},

	'PATCH /threads/:thread_id': {
		params: ['thread_id'],
		body: {
			name: string;
		},
		return: Thread,
	},


	/** Users */

};