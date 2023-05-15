import { readFileSync } from 'fs';

const _keys = {
	'jwt-private': '',
	'jwt-public': '',
};


/**
 * Get the private key for signing jwt
 * 
 * @returns The private key for signing jwt
 */
export function getJwtPrivate() {
	if (!_keys['jwt-private'])
		_keys['jwt-private'] = readFileSync(`credentials/${process.env.NODE_ENV}/jwt-private.key`, { encoding: 'utf8' });

	return _keys['jwt-private'];
}


/**
 * Get the public key for signing jwt
 * 
 * @returns The public key for signing jwt
 */
export function getJwtPublic() {
	if (!_keys['jwt-public'])
		_keys['jwt-public'] = readFileSync(`credentials/${process.env.NODE_ENV}/jwt-public.key`, { encoding: 'utf8' });

	return _keys['jwt-public'];
}