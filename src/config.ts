import axios from 'axios';
import axiosBetterStacktrace from 'axios-better-stacktrace';
import { Algorithm } from 'jsonwebtoken';

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
	
	/** Application config */
	app: {
		/** Message used to notify user to contact/report issue */
		support_message: 'Please contact us if this problem persists.',

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
			/** The default collection name */
			default_collection: 'Main',
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
	},
};
export default config;

// better axios stack trace
axiosBetterStacktrace(axios);