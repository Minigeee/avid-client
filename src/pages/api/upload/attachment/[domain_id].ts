import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter, expressWrapper } from 'next-connect';
import assert from 'assert';

import _config from '@/config';
import { id } from '@/lib/db';
import { token } from '@/lib/utility/authenticate';
import { upload } from '@/lib/utility/spaces';
import { getImageUrl, getResourceUrl } from '@/lib/utility/spaces-util';

const router = createRouter<
  NextApiRequest & { urls: string[] },
  NextApiResponse
>();

router
  .use(token)

  // POST
  .post(
    // Image uploader
    // @ts-ignore
    expressWrapper(
      upload(
        (req: Express.Request<>, file) => {
          const isImage = file.mimetype.startsWith('image');

          // Generate key
          const prefix = isImage ? 'images/' : '';
          const domain_id = req.query.domain_id as string;
          const profile_id = req.token.profile_id;
          const key = `${prefix}attachments/${domain_id}/${id(profile_id)}/${
            file.originalname
          }`;

          // Add resource url
          if (!req.urls) req.urls = [];
          req.urls.push(isImage ? getImageUrl(key) : getResourceUrl(key));

          return key;
        },
        { fileSize: _config.upload.attachment.max_size },
      ).array('attachments', _config.upload.attachment.max_number),
    ),

    async (req, res) => {
      // Send resource url
      res.json({ urls: req.urls });
    },
  );

export const config = {
  api: {
    bodyParser: false,
  },
};

export default router.handler({
  onError: (err: any, req, res) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).end(err.message);
  },
});
