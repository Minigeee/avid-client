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
};
export default config;