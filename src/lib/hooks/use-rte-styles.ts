import { MantineTheme, createStyles } from '@mantine/core';


////////////////////////////////////////////////////////////
const LIGHT_PRIMARY = [
  '#fafafb',
  '#f1f2f4',
  '#e7e8ec',
  '#dcdde3',
  '#c3c4ce',
  '#b2b4c0',
  '#9ea1b0',
  '#63677a',
  '#494b5a',
  '#25272e',
];

////////////////////////////////////////////////////////////
const DEFAULT_THEMES = {
  light: {
    md_code: (theme) => 'rgb(250, 250, 250)',
    md_code_border: (theme) => LIGHT_PRIMARY[3],
    md_code_text: (theme) => theme.colors.gray[8],
    md_inline_code: (theme) => LIGHT_PRIMARY[2],
    md_inline_code_text: (theme) => theme.colors.gray[8],
    md_table_header: (theme) => LIGHT_PRIMARY[1],
    md_table_border: (theme) => LIGHT_PRIMARY[2],
    md_divider: (theme) => theme.colors.gray[4],
    md_ping_member: (theme) => `${theme.colors.gray[2]}80`,
    md_ping_member_text: (theme) => theme.colors.gray[8],
    md_ping_role: (theme) => `${theme.colors.gray[1]}80`,
    md_ping_role_text: (theme) => theme.colors.gray[8],
  },
  dark: {
    md_code: (theme) => LIGHT_PRIMARY[1],
    md_code_text: (theme) => theme.colors.gray[8],
    md_table_header: (theme) => LIGHT_PRIMARY[1],
    md_table_border: (theme) => LIGHT_PRIMARY[2],
    md_divider: (theme) => theme.colors.gray[6],
    md_ping_member: (theme) => `${theme.colors.secondary[2]}80`,
    md_ping_member_text: (theme) => theme.colors.gray[8],
    md_ping_role: (theme) => `${theme.colors.secondary[1]}80`,
    md_ping_role_text: (theme) => theme.colors.gray[8],
  },
} as Record<'light' | 'dark', Record<string, (theme: MantineTheme) => string>>;

////////////////////////////////////////////////////////////
export const useChatStyles = (options?: {
  scale?: number;
  tableMinWidth?: string;
}) => {
  const scale = options?.scale || 1;

  return createStyles((theme) => {
    const colors = theme.other?.elements;

    return {
      typography: {
        lineHeight: 1.6,

        p: {
          marginBlockStart: 0,
          marginBlockEnd: 0,
          fontSize: 14 * scale,
          overflowWrap: 'anywhere',

          '&:not(:last-of-type)': {
            marginBlockEnd: '0.8em',
          },

          a: {
            color: theme.colors.blue[5],
            textDecoration: 'none',
          },

          code: {
            fontFamily: theme.fontFamilyMonospace,

            padding: '0.2em 0.35em',
            background: colors.md_inline_code,
            color: colors.md_inline_code_text,
            borderRadius: 3,
          },

          '.emoji': {
            fontSize: 16 * scale,
            fontFamily:
              '"Apple Color Emoji", "Twemoji Mozilla", "Noto Color Emoji", "Android Emoji"',
          },
        },

        pre: {
          marginBlockStart: 0,
          marginBlockEnd: 0,
          fontSize: 13 * scale,
          tabSize: '4ch',
          whiteSpace: 'pre-wrap',

          padding: '0.5em 0.5em',
          background: colors.md_code,
          color: colors.md_code_text,
          borderRadius: 4,

          '&:not(:last-child)': {
            marginBlockEnd: '0.8em',
          },

          code: {
            fontFamily: theme.fontFamilyMonospace,
          },
        },

        ol: {
          marginBlockStart: 0,
          marginBlockEnd: 0,
          fontSize: 14 * scale,

          '&:not(:last-child)': {
            marginBlockEnd: '0.8em',
          },
        },

        ul: {
          marginBlockStart: 0,
          marginBlockEnd: 0,
          fontSize: 14 * scale,

          '&:not(:last-child)': {
            marginBlockEnd: '0.8em',
          },
        },

        table: {
          minWidth: options?.tableMinWidth,
          fontSize: 14 * scale,
          borderSpacing: 0,

          tr: {
            '&:last-of-type': {
              td: {
                borderBottom: 'none',
              },
            },
          },

          th: {
            padding: '0.5em 0.9em',
            textAlign: 'left',
            fontWeight: 600,
            borderBottom: `2px solid ${colors.md_table_border}`,
            background: colors.md_table_header,

            '&:first-of-type': { borderTopLeftRadius: 3 },
            '&:last-of-type': { borderTopRightRadius: 3 },
          },

          td: {
            padding: '0.4em 0.9em',
            borderBottom: `1px solid ${colors.md_table_border}`,
          },

          '&:not(:last-child)': {
            marginBlockEnd: '0.8em',
          },
        },

        blockquote: {
          margin: 0,
          padding: '0.5em 0em 0.5em 2ch',
          borderLeft: `4px solid ${colors.md_divider}`,

          '&:not(:last-child)': {
            marginBlockEnd: '0.8em',
          },
        },

        mark: {
          padding: '0.05em 0.25em',
          background: theme.colors.yellow[3],
          borderRadius: 3,
        },

        h1: {
          marginBlockStart: 0,
          marginBlockEnd: 0,
          '&:not(:last-child)': {
            marginBlockEnd: '0.3em',
          },
        },

        h2: {
          marginBlockStart: 0,
          marginBlockEnd: 0,
          '&:not(:last-child)': {
            marginBlockEnd: '0.5em',
          },
        },

        h3: {
          marginBlockStart: 0,
          marginBlockEnd: 0,
          '&:not(:last-child)': {
            marginBlockEnd: '0.8em',
          },
        },

        h4: {
          marginBlockStart: 0,
          marginBlockEnd: 0,
          '&:not(:last-child)': {
            marginBlockEnd: '0.8em',
          },
        },

        h5: {
          marginBlockStart: '0.1em',
          marginBlockEnd: '0.1em',
          '&:not(:last-child)': {
            marginBlockEnd: '0.8em',
          },
        },

        h6: {
          marginBlockStart: '0.2em',
          marginBlockEnd: '0.2em',
          '&:not(:last-child)': {
            marginBlockEnd: '0.6em',
          },
        },

        hr: {
          marginBlockStart: '0.6em',
          marginBlockEnd: '0.6em',
          height: 1,
          borderWidth: 0,
          color: colors.md_divider,
          background: colors.md_divider,
        },

        img: {
          maxWidth: '60ch',
        },

        '.katex-display': {
          margin: 0,

          padding: '0.5em 0.5em',
          background: colors.md_inline_code,
          color: colors.md_inline_code_text,
          borderRadius: 4,
        },

        '.eqno': {
          display: 'flex',
          alignItems: 'baseline',
          width: '100%',

          padding: '0em 0.6em',
          background: colors.md_code,
          color: colors.md_code_text,
          borderRadius: 4,

          fontSize: 15 * scale,

          eqn: {
            flexGrow: 1,
            fontSize: 16 * scale,
          },
        },

        '.avid-highlight': {
          padding: '1px 4px 1.5px 3px',
          borderRadius: 3,
        },

        '.avid-mention-member': {
          background: colors.md_ping_member,
          color: colors.md_ping_member_text,
          fontWeight: 600,
        },

        '.avid-mention-role': {
          background: colors.md_ping_role,
          color: colors.md_ping_role_text,
          fontWeight: 600,
        },
      },
    };
  })();
};


////////////////////////////////////////////////////////////
export const useDocumentStyles = (options?: {
  scale?: number;
  tableMinWidth?: string;
}) => {
  const scale = options?.scale || 1;

  // @ts-ignore
  return createStyles((theme) => {
    const colors: Record<string, string> = theme.other?.elements || {};
    if (!theme.other?.elements) {
      for (const [k, v] of Object.entries(DEFAULT_THEMES[theme.colorScheme]))
        colors[k] = v(theme);
    }

    return {
      typography: {
        lineHeight: 1.65,
        
        '.emoji': {
          fontFamily:
            '"Apple Color Emoji", "Twemoji Mozilla", "Noto Color Emoji", "Android Emoji"',
        },

        p: {
          marginBlockStart: 0,
          marginBlockEnd: '1.0em',
          fontSize: 16 * scale,
          overflowWrap: 'anywhere',

          a: {
            color: theme.colors.blue[5],
            textDecoration: 'none',
          },

          code: {
            fontFamily: theme.fontFamilyMonospace,
            fontSize: 14,

            padding: '0.2em 0.35em',
            background: colors.md_inline_code,
            color: colors.md_inline_code_text,
            borderRadius: 3,
          },

          '.emoji': {
            fontSize: 17 * scale,
          },
        },

        pre: {
          marginBlockStart: 0,
          marginBlockEnd: 0,
          fontSize: 14 * scale,
          tabSize: '4ch',
          whiteSpace: 'pre-wrap',

          padding: '0.5rem 0.75rem',
          background: colors.md_code,
          color: colors.md_code_text,
          border: `1px solid ${colors.md_code_border}`,
          borderRadius: theme.radius.sm,

          '&:not(:last-child)': {
            marginBlockEnd: theme.spacing.md,
          },

          code: {
            fontFamily: theme.fontFamilyMonospace,
          },
        },

        ol: {
          marginBlockStart: 0,
          marginBlockEnd: 0,
          fontSize: 16 * scale,

          p: {
            marginBlockEnd: 0,
          },

          '&:not(:last-child)': {
            marginBlockEnd: '1.0em',
          },
        },

        ul: {
          marginBlockStart: 0,
          marginBlockEnd: 0,
          fontSize: 16 * scale,

          p: {
            marginBlockEnd: 0,
          },

          '&:not(:last-child)': {
            marginBlockEnd: '1.0em',
          },
        },

        table: {
          minWidth: options?.tableMinWidth,
          fontSize: 16 * scale,
          borderSpacing: 0,

          tr: {
            '&:last-of-type': {
              td: {
                borderBottom: 'none',
              },
            },
          },

          th: {
            padding: '0.5em 0.9em',
            textAlign: 'left',
            fontWeight: 600,
            borderBottom: `2px solid ${colors.md_table_border}`,
            background: colors.md_table_header,

            '&:first-of-type': { borderTopLeftRadius: 3 },
            '&:last-of-type': { borderTopRightRadius: 3 },
          },

          td: {
            padding: '0.4em 0.9em',
            borderBottom: `1px solid ${colors.md_table_border}`,
          },

          '&:not(:last-child)': {
            marginBlockEnd: '1.0em',
          },
        },

        blockquote: {
          margin: 0,
          padding: '0.5em 0em 0.5em 2ch',
          borderLeft: `4px solid ${colors.md_divider}`,

          p: {
            marginBlockEnd: 0,

            '&:not(:last-child)': {
              marginBlockEnd: '1.0em',
            },
          },

          '&:not(:last-child)': {
            marginBlockEnd: '1.0em',
          },
        },

        mark: {
          padding: '0.05em 0.25em',
          background: theme.colors.yellow[3],
          borderRadius: 3,
        },

        h1: {
          fontSize: '2.25rem',
          marginBlockStart: theme.spacing.xl,
          marginBlockEnd: theme.spacing.sm,

          '&:first-child': {
            marginBlockStart: 0,
          },
        },

        h2: {
          fontSize: '1.625rem',
          marginBlockStart: theme.spacing.xl,
          marginBlockEnd: theme.spacing.sm,
        },

        h3: {
          fontSize: '1.375rem',
          marginBlockStart: theme.spacing.lg,
          marginBlockEnd: theme.spacing.sm,
        },

        h4: {
          marginBlockStart: 0,
          marginBlockEnd: 0,
          '&:not(:last-child)': {
            marginBlockEnd: '0.8em',
          },
        },

        h5: {
          marginBlockStart: '0.1em',
          marginBlockEnd: '0.1em',
          '&:not(:last-child)': {
            marginBlockEnd: '0.8em',
          },
        },

        h6: {
          marginBlockStart: '0.2em',
          marginBlockEnd: '0.2em',
          '&:not(:last-child)': {
            marginBlockEnd: '0.6em',
          },
        },

        hr: {
          marginBlockStart: '2.5rem',
          marginBlockEnd: '2.5rem',
          marginLeft: '0.25rem',
          marginRight: '0.25rem',
          height: 1,
          borderWidth: 0,
          color: colors.md_divider,
          background: colors.md_divider,
        },

        img: {
          width: '100%',
          borderRadius: theme.radius.sm,
          marginBlockEnd: theme.spacing.md,
        },

        '.katex-display': {
          margin: 0,

          padding: '0.5em 0.5em',
          background: colors.md_inline_code,
          color: colors.md_inline_code_text,
          borderRadius: 4,
        },

        '.eqno': {
          display: 'flex',
          alignItems: 'baseline',
          width: '100%',

          padding: '0.5rem 0.75rem',
          background: colors.md_code,
          color: colors.md_code_text,
          border: `1px solid ${colors.md_code_border}`,
          borderRadius: theme.radius.sm,

          fontSize: 17 * scale,

          eqn: {
            flexGrow: 1,
            fontSize: 18 * scale,
          },
        },



        'div[data-youtube-video]': {
          width: '100%',
          marginBlockEnd: theme.spacing.md,

          iframe: {
            width: '100%',
            aspectRatio: 16 / 9,
          },
        },

        '.avid-pre': {
          marginBlockEnd: theme.spacing.md,
        },

        '.avid-highlight': {
          padding: '1px 4px 1.5px 3px',
          fontSize: 15,
          borderRadius: 3,
        },

        '.avid-mention-member': {
          background: colors.md_ping_member,
          color: colors.md_ping_member_text,
          fontWeight: 600,
        },

        '.avid-mention-role': {
          background: colors.md_ping_role,
          color: colors.md_ping_role_text,
          fontWeight: 600,
        },
      },
    };
  })();
};
