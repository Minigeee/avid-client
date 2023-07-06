import axios from 'axios';
import axiosBetterStacktrace from 'axios-better-stacktrace';
import sanitizeHtml from 'sanitize-html';

const dev_mode = process.env.NODE_ENV === 'development';


/** App config */
const config = {
	/** Indicates if server is in development mode */
	dev_mode,

	/** Version info */
	version: {
		/** Major version number */
		major: 0,
		/** Minor version number */
		minor: 1,
		/** Patch version number */
		patch: 2,
		/** Revision number */
		revision: 0,
		/** Build metadata */
		metadata: ['alpha'],
	},

	/** Domain address values */
	domains: {
		/** API address */
		api: dev_mode ? 'http://localhost:3001' : 'https://api.avidapp.io',
		/** Site address */
		site: dev_mode ? 'http://localhost:3000' : 'https://avidapp.io',
		/** App path */
		app_path: '/app',
	},

	/** Database config */
	db: {
		/** Database url */
		url: dev_mode ? 'http://127.0.0.1:8000/sql' : 'https://db.avidapp.io/sql',
		/** Default namespace */
		namespace: dev_mode ? 'test' : 'main',
		/** Default databse */
		database: dev_mode ? 'test' : 'main',
		/** Default scope */
		scope: 'main',
		/** Default token */
		token: dev_mode ? 'main' : 'client',

		/** Functions */
		fns: {
			add_domain: ({}) => `function($channels) { return arguments[0].map((x)=>x.id); }`,
			add_tags: ({ add, update }) => `function() { for (const tag of ${update}){ const idx = this.tags.findIndex((x)=>x.id === tag.id); if (idx >= 0) this.tags[idx] = { ...this.tags[idx], ...tag }; } return this.tags.concat(${add}.map((x, i)=>({ ...x, id: (this._id_counter + i).toString() }))); }`,
			remove_collection: ({ collection_id }) => `function() { return this.collections.filter((x)=>x.id !== ${collection_id}); }`,
			update_collection: ({ collection_id, collection }) => `function() { const idx = this.collections.findIndex((x)=>x.id === ${collection_id}); if (idx >= 0) this.collections[idx] = { ...this.collections[idx], ...${collection} }; return this.collections; }`,
			update_tasks: ({ newStatus, now }) => `function() { return ${newStatus} && ${newStatus} !== this.status ? ${now} : this.time_status_updated; }`,
		} as Record<string, (hardcodes: any) => string>,
	},

	/** Fetcher config */
	swr: {
		/** Minimum amount of time in between requesting any given key twice (seconds) */
		dedupe_interval: 5 * 60,
		/** Minimum amount of time in between revalidating data (seconds) */
		focus_throttle_interval: 2 * 60,
	},

	/** Html sanitization options */
	sanitize: {
		allowedTags: [
			...sanitizeHtml.defaults.allowedTags,
			'img',
		],
		allowedAttributes: {
			...sanitizeHtml.defaults.allowedAttributes,
			'*': ['style'],
		},
		allowedClasses: {
			code: ['language-*'],
			'*': ['avid*', 'hljs*'],
		},
	} as sanitizeHtml.IOptions,

	/** Digital Ocean Spaces config */
	spaces: {
		/** The spaces endpoint */
		endpoint: 'https://nyc3.digitaloceanspaces.com',
		/** The spaces bucket */
		bucket: 'avid-spaces',
	},

	/** Upload configs */
	upload: {
		/** Profile picture config */
		profile_picture: {
			/** Image size */
			image_size: { w: 256, h: 256 },
			/** Max size (in bytes) */
			max_size: 1 * 1024 ** 2,
		},
		/** Attachment config */
		attachment: {
			/** Max attachment size in bytes */
			max_size: 10 * 1024 ** 2,
			/** Max number of upload items */
			max_number: 10,
		},
	},
	
	/** Application config */
	app: {
		/** Message used to notify user to contact/report issue */
		support_message: 'Please contact us if issue keeps happening.',
		/** Contact info */
		contact: {
			/** Feedback google form */
			feedback_form: 'https://forms.gle/b6Sq6nzFan43nXD16',
			/** Contact email */
			email: 'minigeee0@gmail.com',
		},
		/** Amount of time to wait before updating navigation state */
		nav_update_timeout: 10 * 1000,

		/** General ui config */
		ui: {
			/** Width for short length input */
			short_input_width: '22rem',
			/** Width for medium length input */
			med_input_width: '32rem',
			/** Max width for general settings UI */
			settings_maw: '36rem',
			/** The viewport position threshold the user must be at to trigger more data fetching (px) */
			load_next_treshold: 1200,
		},

		/** Message config */
		message: {
			/** Query limit */
			query_limit: 100,
			/** Max role id length limit */
			max_mention_length: 24,
			/** Characters used for member mentions */
			member_mention_chars: '{}',
			/** Characters used for role mentions */
			role_mention_chars: '[]',
			/** Number of seconds before messages view should be reset to a single page of data */
			multiple_pages_time: 5 * 60,
		},

		/** Project board config */
		board: {
			/** Default task view */
			default_task_view: 'kanban',
			/** Default tag color */
			default_tag_color: '#495057',

			/** Default statuses */
			default_statuses: [
				{ id: 'todo', label: 'To Do', color: '#868E96' },
				{ id: 'in-progress', label: 'In Progress', color: '#228BE6' },
				{ id: 'completed', label: 'Completed', color: '#40C057' },
			],
			/** Defualt status id */
			default_status_id: 'todo',

			/** Default backlog */
			default_backlog: {
				id: 'backlog',
				name: 'Backlog',
				description: 'A backlog is typically used as a collection of tasks, features, or issues ' + 
					'that have not yet been completed. The backlog can be used in many different ways, but ' +
					'the most common way is to pull tasks from the backlog into a separate collection of tasks ' +
					'that is worked on during the current period. This process can be started ' +
					'by creating a new "objective" collection, define your team\'s current focus and priorities in its description, ' +
					'then move any task that belongs within that objective into it.',
			},
			/** All collection */
			all_collection: {
				value: 'all',
				id: 'all',
				label: 'All',
				name: 'All',
				description: 'All tasks in this board',
			},

			/** Task sort keys */
			sort_keys: {
				/** Priority sort keys */
				priority: {
					critical: 0,
					high: 1,
					medium: 2,
					low: 3,
				},
			},
		},

		/** Member related configs */
		member: {
			/** The number of seconds where data in a member cache is considered to be valid */
			cache_lifetime: 60 * 60,
			/** The maximum number of members returned in any given query */
			query_limit: 200,
			/** The number of seconds for which a member query is considered to be stale */
			query_interval: 5 * 60,
			/** The number of members under which a new query should be requested when searching members */
			new_query_threshold: 20,
		},

		/** Rtc config */
		rtc: {
			/** List of available rtc servers */
			servers: [
				dev_mode ? 'localhost:3002' : 'https://rtc.avidapp.io',
			],
		},
	},
};
export default config;

// better axios stack trace
axiosBetterStacktrace(axios);