import assert from 'assert';

import _config from '@/config';


/** Spaces config */
export const config = {
	/** Spaces url endpoint */
	endpoint: `https://${_config.spaces.bucket}.${_config.spaces.endpoint.split('/').at(-1)}`,
	/** Image path path */
	img_path: 'images',
}


/**
 * Get a resource url from its key
 * 
 * @param key The key of the resource
 * @returns The resource url string
 */
export function getResourceUrl(key: string) {
	return `${config.endpoint}/${process.env.NODE_ENV}/${key}`;
}

/**
 * Get a resource key from its url
 * 
 * @param url The url of the resource
 * @returns The resource key
 */
export function getResourceKey(url: string) {
	// Resource needs to start with string
	assert(url.startsWith(config.endpoint));
	return url.substring(config.endpoint.length + process.env.NODE_ENV.length + 2);
}


/**
 * Get a image url from its key. The url is the expected `src` value
 * assuming the image optimizer will be used.
 * 
 * @param key The key of the image
 * @returns The image url string
 */
export function getImageUrl(key: string) {
	assert(key.startsWith(config.img_path));
	return key.substring(config.img_path.length + 1);
}

/**
 * Get a image key from its url. The url is expected to be
 * in the form that the image optimizer uses.
 * 
 * @param url The url of the image
 * @returns The image key
 */
export function getImageKey(url: string) {
	if (url.startsWith('/'))
		url = url.substring(1);
	return config.img_path + '/' + url;
}