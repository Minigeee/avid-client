import { Attachment } from './attachment';
import { WithId } from './util';

/** Wiki doc type */
export type Wiki = {
  /** Id of the doc */
  id: string;
  /** Content of the doc */
  content: string;
  /** Optional draft (not published saves) */
  draft?: string | null;
  /** List of attachment ids */
  attachments?: string[];
};

/** Wiki with extra data */
export type ExpandedWiki = Omit<Wiki, 'attachments'> & {
    /** List of attachments */
    attachments?: WithId<Attachment>[];
};
