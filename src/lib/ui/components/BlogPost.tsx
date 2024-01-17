import { useMemo } from 'react';

import { useChatStyles, useDocumentStyles } from '@/lib/hooks';

import hljs from 'highlight.js';
import MarkdownIt from 'markdown-it';

/** Markdown renderer */
const _md = new MarkdownIt({
  linkify: true,
  breaks: true,

  highlight: (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const result = hljs.highlight(str, { language: lang }).value;
        return result;
      } catch (__) {}
    }

    return ''; // use external default escaping
  },
})
  .use(require('markdown-it-sub'))
  .use(require('markdown-it-sup'))
  .use(require('markdown-it-mark'))
  .use(require('markdown-it-texmath'), {
    engine: require('katex'),
    delimiters: 'dollars',
  });

////////////////////////////////////////////////////////////
export type BlogPostProps = {
  post: string;

  width?: string;
  fontScale?: number;
};

////////////////////////////////////////////////////////////
export default function BlogPost(props: BlogPostProps) {
  const { classes } = useDocumentStyles({ scale: props.fontScale });

  // Render post
  const rendered = useMemo(() => {
    return _md.render(props.post);
  }, [props.post]);

  return (
    <div
      className={classes.typography}
      dangerouslySetInnerHTML={{ __html: rendered }}
      style={{
        width: props.width || '60ch',
        maxWidth: '100%',
      }}
    />
  );
}
