import { Algorithm } from 'jsonwebtoken';


const dev_mode = process.env.NODE_ENV === 'development';

const api_config = {
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
};

export default api_config;