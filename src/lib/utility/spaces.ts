import assert from 'assert';

import config from '@/config';

import { S3 } from '@aws-sdk/client-s3';
import multer, { Options } from 'multer';
import multerS3 from 'multer-s3';

// Adds env
function _key(key: string) {
  return process.env.NODE_ENV + '/' + key;
}

assert(process.env.DIGITAL_OCEAN_SPACES_ACCESS_KEY);
assert(process.env.DIGITAL_OCEAN_SPACES_SECRET);

/** S3 client */
const s3client = new S3({
  forcePathStyle: false, // Configures to use subdomain/virtual calling format.
  endpoint: config.spaces.endpoint,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.DIGITAL_OCEAN_SPACES_ACCESS_KEY,
    secretAccessKey: process.env.DIGITAL_OCEAN_SPACES_SECRET,
  },
});

/**
 * Create a file upload middleware using multer
 *
 * @param key A function that generates a file key (location) to store the incoming data
 * @param options The file limits options
 * @returns A multer middleware object
 */
export function upload(
  key: (req: Express.Request, file: Express.Multer.File) => string,
  options?: Options['limits'],
) {
  return multer({
    storage: multerS3({
      s3: s3client,
      bucket: config.spaces.bucket,
      acl: 'public-read',
      key: (req, file, cb) => {
        try {
          cb(null, _key(key(req, file)));
        } catch (err) {
          cb(err, undefined);
        }
      },
      contentType: (req, file, cb) => {
        let type = 'application/octet-stream';
        // Make images the correct type
        if (file.mimetype.startsWith('image')) type = file.mimetype;

        cb(null, type);
      },
    }),
    limits: options,
  });
}

export const s3 = {
  /** The s3 client */
  client: s3client,

  /**
   * Delete a resource
   *
   * @param key The key of the resource to delete
   * @returns The output promise
   */
  delete: (key: string) =>
    s3client.deleteObject({
      Bucket: config.spaces.bucket,
      Key: _key(key),
    }),

  /**
   * Get a resource
   *
   * @param key The key of the resource to retrieve
   * @returns The output promise
   */
  get: (key: string) =>
    s3client.getObject({
      Bucket: config.spaces.bucket,
      Key: _key(key),
    }),
};
