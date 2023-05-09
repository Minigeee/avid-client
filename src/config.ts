import axios from 'axios';
import axiosBetterStacktrace from 'axios-better-stacktrace';
import { Algorithm } from 'jsonwebtoken';
import sanitizeHtml from 'sanitize-html';

const dev_mode = process.env.NODE_ENV === 'development';


/** App config */
const config = {
	/** Indicates if server is in development mode */
	dev_mode,

	/** Domain address values */
	domains: {
		/** API address */
		api: dev_mode ? 'http://localhost:3001' : '',
		/** Site address */
		site: dev_mode ? 'http://localhost:3000' : '',
		/** App path */
		app_path: '/app',
	},

	/** Authorization config */
	auth: {
		/** Token cookie name */
		cookie_name: 'sid',
		/** Max id token (and cookie) age in seconds */
		max_id_token_age: 14 * 24 * 60 * 60,
		/** Max access token age in seconds */
		max_access_token_age: 1 * 24 * 60 * 60,

		/** JWT signing algorithm */
		jwt_algorithm: 'RS256' as Algorithm,
	},

	/** Database config */
	db: {
		/** Database url */
		url: dev_mode ? 'http://127.0.0.1:8000/sql' : '',
		/** Default namespace */
		namespace: dev_mode ? 'test' : 'main',
		/** Default databse */
		database: dev_mode ? 'test' : 'main',
		/** Default token */
		token: 'main',
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
	
	/** Application config */
	app: {
		/** Message used to notify user to contact/report issue */
		support_message: 'Please contact us if this problem persists.',
		/** Amount of time to wait before updating navigation state */
		nav_update_timeout: 10 * 1000,

		/** General ui config */
		ui: {
			/** Width for short length input */
			short_input_width: '40ch',
			/** Width for medium length input */
			med_input_width: '60ch',
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
					'that have not yet been completed. These items are typically prioritized ' + 
					'based on their importance and urgency, and are worked on by a team over ' + 
					'a series of cycles. During each cycle, the team selects a subset of items ' + 
					'from the backlog to work on, with the goal of completing as many items as ' + 
					'possible within the cycle period. At the end of each cycle, the team reviews ' + 
					'their progress and re-prioritizes the items in the backlog based on what they ' + 
					'have learned. By using a backlog and cycles in this way, teams can stay ' + 
					'focused on their goals and make steady progress towards completing their work.',
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
			/** The number of seconds for which a member query is considered to have updated data */
			query_interval: 3 * 60,
			/** The number of members under which a new query should be requested when searching members */
			new_query_threshold: 5,
		},

		/** Rtc config */
		rtc: {
			/** List of available rtc servers */
			servers: [
				'localhost:3002',
			],
		},
	},
};
export default config;

// better axios stack trace
axiosBetterStacktrace(axios);