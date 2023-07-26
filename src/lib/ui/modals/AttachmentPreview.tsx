import { useMemo } from 'react';

import { Image } from '@mantine/core';
import { ContextModalProps } from '@mantine/modals';

import { Attachment } from '@/lib/types';
import { config as spacesConfig, getResourceUrl } from '@/lib/utility/spaces-util';


////////////////////////////////////////////////////////////
export type AttachmentPreviewProps = {
  attachment: Attachment
};

////////////////////////////////////////////////////////////
export default function AttachmentPreview({ context, id, innerProps: props }: ContextModalProps<AttachmentPreviewProps>) {
  const { attachment } = props;

  // Get image size
  const size = useMemo(() => {
    if (!attachment.width || !attachment.height)
      return { w: 0, h: 0 };

    const windowAr = window.innerWidth / window.innerHeight;
    const imageAr = attachment.width / attachment.height;

    const MAX_IMAGE_WIDTH = 80;
    const MAX_IMAGE_HEIGHT = 90 / windowAr;

    // Determine if width or height should be filled
    let w = 0, h = 0;
    if (imageAr > windowAr) {
      // Wide image, fill width
      w = MAX_IMAGE_WIDTH;
      h = w / imageAr;
    }
    else {
      // Tall image, fill width
      h = MAX_IMAGE_HEIGHT;
      w = h * imageAr;
    }

    return { w, h };
  }, [attachment.type]);


  if (props.attachment.type === 'image') {
    return (
      <Image
        key={props.attachment.filename}
        src={getResourceUrl(`${spacesConfig.img_path}/${props.attachment.url}`)}
        alt={props.attachment.filename}
        width={`${size.w}vw`}
        height={`${size.h}vw`}
        style={{ borderRadius: 6 }}
        title={props.attachment.filename}
      />
    );
  }

  return null;
}
