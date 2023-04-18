import { NextApiRequest, NextApiResponse } from 'next';
import assert from 'assert';
import { serialize, parse } from 'cookie';

import passport, { AuthenticateOptions } from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { sign, verify } from 'jsonwebtoken';
import { uid } from 'uid';

import config from '@/config';
import { users } from '@/lib/db';


/** Available authentication providers */
export type AuthProviders = 'google';

/** Jwt payload */
export type JwtPayload = {
	/** The id of the user within the provider's auth system */
	provider_id: string;
	/** The provider used to sign in */
	provider: AuthProviders;
	/** An email associated with user */
	email?: string;
};


////////////////////////////////////////////////////////////
function _setIdCookie(user_id: string, key: string, res: NextApiResponse) {
	assert(process.env.JWT_SECRET);

	// Create id token
	const jwt = sign({ id: user_id, key }, process.env.JWT_SECRET, {
		algorithm: config.auth.jwt_algorithm,
		expiresIn: config.auth.max_id_token_age,
	});

	// Set token as cookie
	const cookie = serialize(config.auth.cookie_name, jwt, {
		maxAge: config.auth.max_id_token_age,
		expires: new Date(Date.now() + config.auth.max_id_token_age * 1000),
		httpOnly: true,
		secure: !config.dev_mode,
		path: '/',
		sameSite: 'strict',
	});
	res.setHeader('Set-Cookie', cookie);
}


// Make sure all env variables are set
assert(process.env.GOOGLE_CLIENT_ID);
assert(process.env.GOOGLE_CLIENT_SECRET);

const strategies = {
	// Google
	google: new GoogleStrategy({
		clientID: process.env.GOOGLE_CLIENT_ID,
		clientSecret: process.env.GOOGLE_CLIENT_SECRET,
		callbackURL: `${config.domains.site}/api/login/callbacks/google`,
	}, (accessToken, refreshToken, profile, cb) => cb(null, {
		provider_id: profile.id,
		provider: 'google',
		email: profile.emails?.length ? profile.emails[0].value : undefined,
	})),
};

/** Initialize passport and more auth settings */
export function initialize() {
	passport.use(strategies.google);
}


/**
 * `passport.authenticate`
 * 
 * @param method The authentication method
 * @param req The request object
 * @param res The response object
 * @returns The resulting token payload promise
 */
export function authenticate(method: AuthProviders, options: AuthenticateOptions, req: NextApiRequest, res: NextApiResponse) {
	return new Promise<any>((resolve, reject) => {
		passport.authenticate(method, options, (error: any, token: any) => {
			if (error) {
				reject(error)
			} else {
				resolve(token)
			}
		})(req, res)
	});
}


/**
 * Complete the sign in process:
 * - Get or create a user associated with the given auth provider
 * - Generate an id token
 * - Redirect to app
 * 
 * @param user The partial user object (only provider info)
 * @param res The response object
 * @param redirect The redirect url
 * @returns The signed jwt string
 */
export async function signin(user: JwtPayload, res: NextApiResponse, redirect?: string) {
	// Create/get user object
	const full_user = await users.getByProvider(user.provider_id, user.provider, user.email);

	// Create id token
	_setIdCookie(full_user.id, full_user._id_key, res);

	// Redirect
	res.redirect(redirect || `${config.domains.site}/app`);
}


/**
 * Return access token and set new id token
 * 
 * @param req The request object
 * @param res The response object
 */
export async function refresh(req: NextApiRequest, res: NextApiResponse) {
	try {
		assert(process.env.JWT_SECRET);

		const token = req.cookies[config.auth.cookie_name];
		assert(token);

		// Get payload
		const id_payload = verify(token, process.env.JWT_SECRET);
		assert(typeof id_payload === 'object');

		// Get user
		const user = await users.get(id_payload.id);
		assert(user && id_payload.key === user._id_key);

		// Create new id token
		const new_key = uid();
		_setIdCookie(user.id, new_key, res);

		// Create access token
		const access_token = sign({
			user_id: user.id,
			profile_id: user.current_profile,
		}, process.env.JWT_SECRET, {
			algorithm: config.auth.jwt_algorithm,
			expiresIn: config.auth.max_access_token_age,
		});

		// Save new id key
		await users.update(user.id, { _id_key: new_key });

		return access_token;

	} catch (err) {
		// By default, make user relog if error occurs
		res.status(401).end();
	}
}