/** Types of supported attachments */
export type AttachmentType = 'image' | 'file';

/** Base attachment */
type _BaseAttachment = {
  /** The type of attachment */
  type: AttachmentType;
  /** The width of the attachment if the type is image (px) */
  width?: number;
  /** The height of the attachment if the type is image (px) */
  height?: number;
};

/** Type representing an attachment with a file object */
export type FileAttachment = _BaseAttachment & {
  /** The file attachment */
  file: File;
};

/** Type representing an attachment as it is stored in the database */
export type Attachment = _BaseAttachment & {
  /** The url of the attachment */
  url: string;
  /** Original filename */
  filename: string;
};
