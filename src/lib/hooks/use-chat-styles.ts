import { createStyles } from '@mantine/core';


////////////////////////////////////////////////////////////
export const useChatStyles = (options?: { scale?: number; tableMinWidth?: string }) => {
	const scale = options?.scale || 1;

	return createStyles((theme) => ({
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
					backgroundColor: theme.colors.dark[8],
					borderRadius: 3,
				},

				'.emoji': {
					fontSize: 16 * scale,
					fontFamily: '"Apple Color Emoji", "Twemoji Mozilla", "Noto Color Emoji", "Android Emoji"',
				},
			},

			pre: {
				marginBlockStart: 0,
				marginBlockEnd: 0,
				fontSize: 13 * scale,
				tabSize: '4ch',

				padding: '0.5em 0.5em',
				backgroundColor: theme.colors.dark[8],
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
					borderBottom: `2px solid ${theme.colors.dark[4]}80`,
					backgroundColor: `${theme.colors.dark[8]}80`,

					'&:first-of-type': { borderTopLeftRadius: 3, },
					'&:last-of-type': { borderTopRightRadius: 3, },
				},

				td: {
					padding: '0.4em 0.9em',
					borderBottom: `1px solid ${theme.colors.dark[4]}`,
				},

				'&:not(:last-child)': {
					marginBlockEnd: '0.8em',
				},
			},

			blockquote: {
				margin: 0,
				padding: '0.5em 0em 0.5em 2ch',
				borderLeft: `4px solid ${theme.colors.dark[4]}`,

				'&:not(:last-child)': {
					marginBlockEnd: '0.8em',
				},
			},

			mark: {
				padding: '0.05em 0.25em',
				backgroundColor: theme.colors.yellow[3],
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
				color: theme.colors.dark[3],
				backgroundColor: theme.colors.dark[3],
			},

			img: {
				maxWidth: '60ch',
			},


			'.katex-display': {
				margin: 0,

				padding: '0.5em 0.5em',
				backgroundColor: theme.colors.dark[8],
				borderRadius: 4,
			},

			'.eqno': {
				display: 'flex',
				alignItems: 'baseline',
				width: '100%',

				padding: '0em 0.6em',
				backgroundColor: theme.colors.dark[8],
				borderRadius: 4,

				fontSize: 15 * scale,

				'eqn': {
					flexGrow: 1,
					fontSize: 16 * scale,
				},
			},

			'.avid-highlight': {
				padding: '1px 4px 1.5px 3px',
				borderRadius: 3,
			},

			'.avid-mention-member': {
				backgroundColor: theme.colors.gray[8],
				color: theme.colors.dark[0],
				fontWeight: 600,
			},

			'.avid-mention-role': {
				backgroundColor: theme.colors.gray[7],
				color: theme.colors.dark[0],
				fontWeight: 600,
			},
		}
	}))();
};