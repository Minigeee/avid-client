import { PropsWithChildren, MutableRefObject, useEffect, useImperativeHandle, useState, forwardRef } from 'react';

import {
  ActionIcon,
  Box,
  Button,
  ColorPicker,
  DEFAULT_THEME,
  Divider,
  Group,
  Popover,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';

import {
  Bold,
  Italic,
  Link as IconLink,
  List,
  ListNumbers,
  Palette,
  PaletteOff,
  Strikethrough,
  Subscript as IconSubscript,
  Superscript as IconSuperscript,
  Underline as IconUnderline,
} from 'tabler-icons-react';

import { useEditor, EditorContent, Editor, Extension, ReactRenderer, JSONContent } from '@tiptap/react';
import BulletList from '@tiptap/extension-bullet-list';
import CharacterCount from '@tiptap/extension-character-count';
import Color from '@tiptap/extension-color';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import OrderedList from '@tiptap/extension-ordered-list';
import Placeholder from '@tiptap/extension-placeholder';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';

import PingMention from './PingMention';

import config from '@/config';
import { DomainWrapper, useChatStyles, useSession } from '@/lib/hooks';


////////////////////////////////////////////////////////////
const PRESET_COLORS: string[] = [];
for (const [name, colors] of Object.entries(DEFAULT_THEME.colors)) {
  if (name === 'red' || name === 'gray' || name === 'yellow' || name === 'lime')
    PRESET_COLORS.push(colors[7]);
  else if (name !== 'dark')
    PRESET_COLORS.push(colors[6]);
}
PRESET_COLORS.push(DEFAULT_THEME.colors.gray[6]);


////////////////////////////////////////////////////////////
type EditorButtonProps = PropsWithChildren & {
  active?: boolean;
  tooltip?: string;
  onClick?: () => unknown,
}

////////////////////////////////////////////////////////////
function EditorButton({ active, tooltip, ...props }: EditorButtonProps) {
  return (
    <Tooltip
      label={tooltip || ''}
      position='top'
      withArrow
      openDelay={500}
      sx={(theme) => ({ backgroundColor: theme.colors.dark[9] })}
    >
      <ActionIcon
        sx={(theme) => ({
          backgroundColor: theme.colors.dark[active ? 6 : 8],
          '&:hover': {
            backgroundColor: theme.colors.dark[active ? 6 : 7],
          },
        })}
        onClick={props.onClick}
      >
        {props.children}
      </ActionIcon>
    </Tooltip>
  );
}


////////////////////////////////////////////////////////////
function LinkInterface({ editor }: { editor: Editor | null }) {
  const [opened, setOpened] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [link, setLink] = useState<string>('');
  const [dirty, setDirty] = useState<boolean>(false);


  function onSubmit() {
    if (editor && title && link) {
      const start = editor.state.selection.from;

      editor
        .chain()
        .focus()
        .insertContent(title + ' ')
        .setTextSelection({ from: start, to: start + title.length })
        .setLink({ href: link })
        .setTextSelection(start + title.length + 1)
        .run();
    }

    setTitle('');
    setLink('');
    setDirty(false);
    setOpened(false);
  }

  return (
    <Popover
      width='40ch'
      position='top'
      shadow='lg'
      withinPortal
      withArrow
      trapFocus

      opened={opened}
      onChange={setOpened}
    >
      <Popover.Target>
        <ActionIcon onClick={() => setOpened(!opened)}>
          <IconLink size={18} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack spacing='xs'>
          <TextInput
            label='Title'
            placeholder='Link title'
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.repeat) return;
              if (e.key === 'Enter' && title && link) {
                e.preventDefault();
                onSubmit();
              }

              setDirty(true);
            }}
          />
          <TextInput
            label='Link'
            placeholder='https://www.your-link.com'
            value={link}
            mb={5}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setLink(value);
              if (!dirty)
                setTitle(value);
            }}
            onKeyDown={(e) => {
              if (e.repeat) return;
              if (e.key === 'Enter' && title && link) {
                e.preventDefault();
                onSubmit();
              }
            }}
          />
          {editor?.isActive('link') && (
            <Button variant='default' onClick={() => {
              editor?.chain().focus().unsetLink().run();

              setTitle('');
              setLink('');
              setDirty(false);
              setOpened(false);
            }}>
              Remove Link
            </Button>
          )}
          <Button variant='gradient' onClick={onSubmit}>
            Insert Link
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}


////////////////////////////////////////////////////////////
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    customExtension: {
      /**
       * Comments will be added to the autocomplete.
       */
      addNewline: () => ReturnType,
    }
  }
}

////////////////////////////////////////////////////////////
const CustomNewline = Extension.create<{}, { onEnter: (() => boolean) | null }>({
  name: 'newline',
  // priority: 1000,
  addStorage() {
    return {
      onEnter: null,
    };
  },
  addCommands() {
    return {
      addNewline:
        () =>
          ({ state, dispatch }) => {
            const { schema, tr } = state;
            const paragraph = schema.nodes.paragraph;

            const transaction = tr
              .deleteSelection()
              .replaceSelectionWith(paragraph.create(), true)
              .scrollIntoView();
            if (dispatch) dispatch(transaction);
            return true;
          },
    };
  },
  addKeyboardShortcuts() {
    return {
      'Enter': () => this.storage.onEnter ? this.storage.onEnter() : false,
    };
  },
});


////////////////////////////////////////////////////////////
const CustomBulletList = BulletList.extend({
  addKeyboardShortcuts() {
    return {
      'Tab': () => true,
    };
  }
});


////////////////////////////////////////////////////////////
const CustomOrderedList = OrderedList.extend({
  addKeyboardShortcuts() {
    return {
      'Tab': () => true,
    };
  }
});


////////////////////////////////////////////////////////////
export type RichTextEditorProps = {
  variant?: 'minimal' | 'full' | 'inline';
  placeholder?: string;
  autofocus?: boolean;
  markdown?: boolean;
  rightSection?: JSX.Element;
  maxCharacters?: number;
  maxHeight?: string | number;

  domain?: DomainWrapper;

  editorRef?: MutableRefObject<Editor | null | undefined>;
  value?: string;
  onChange?: (value: string) => unknown;
  onSubmit?: () => unknown;
}

////////////////////////////////////////////////////////////
export default function RichTextEditor(props: RichTextEditorProps) {
  const variant = props.variant || 'full';

  const session = useSession();
  const { classes } = useChatStyles();

  const editor = useEditor({
    extensions: [
      CustomNewline,
      BulletList,
      CharacterCount.configure({ limit: props.maxCharacters }),
      Color,
      Image,
      Link.configure({ openOnClick: false }),
      ...(props.domain?._exists ? [
        PingMention.configure({
          session,
          domain: props.domain,
        }),
      ] : []),
      OrderedList,
      Placeholder.configure({ placeholder: props.placeholder }),
      Subscript,
      Superscript,
      StarterKit.configure({
        bulletList: false,
        orderedList: false,
      }),
      TextStyle,
      Underline,
    ],
    content: props.value,
    onUpdate: ({ editor }) => {
      if (props.onChange)
        props.onChange(editor.getHTML());
    },
    autofocus: props.autofocus || false,
  });

  useEffect(() => {
    if (!editor) return;
    editor.storage.newline.onEnter = () => {
      if (variant === 'minimal') {
        if (props.onSubmit)
          props.onSubmit();
        return true;
      }

      return false;
    };
  }, [variant, editor?.storage.characterCount.characters()]);

  if (props.editorRef)
    props.editorRef.current = editor;

  if (!editor) return (null);


  return (
    <Box sx={(theme) => ({
      width: '100%',
      '.ProseMirror': {
        '&:focus': {
          outline: 'none',
        },
        '.is-editor-empty': {
          ':first-child': {
            '::before': {
              color: theme.colors.dark[3],
              content: 'attr(data-placeholder)',
              float: 'left',
              height: 0,
              pointerEvents: 'none',
            },
          },
        },
      },
    })}>
      {variant === 'full' && (
        <Box sx={(theme) => ({
          padding: '0.35rem 0.55rem',
          backgroundColor: theme.colors.dark[8],
          border: `1px solid ${theme.colors.dark[4]}`,
          borderBottom: 'none',
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
        })}>
          <Group spacing={2}>
            <EditorButton
              tooltip='Bold'
              active={editor?.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold size={18} />
            </EditorButton>
            <EditorButton
              tooltip='Italic'
              active={editor?.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic size={18} />
            </EditorButton>
            <EditorButton
              tooltip='Underline'
              active={editor?.isActive('underline')}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <IconUnderline size={19} />
            </EditorButton>
            <EditorButton
              tooltip='Strikethrough'
              active={editor?.isActive('strike')}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            >
              <Strikethrough size={18} />
            </EditorButton>
            <EditorButton
              tooltip='Subscript'
              active={editor?.isActive('subscript')}
              onClick={() => editor.chain().focus().toggleSubscript().run()}
            >
              <IconSubscript size={18} />
            </EditorButton>
            <EditorButton
              tooltip='Superscript'
              active={editor?.isActive('superscript')}
              onClick={() => editor.chain().focus().toggleSuperscript().run()}
            >
              <IconSuperscript size={18} />
            </EditorButton>

            <Divider orientation='vertical' mt={3} mb={3} />

            <EditorButton
              tooltip='Bullet List'
              active={editor?.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <List size={19} />
            </EditorButton>
            <EditorButton
              tooltip='Ordered List'
              active={editor?.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <ListNumbers size={19} />
            </EditorButton>

            <Divider orientation='vertical' mt={3} mb={3} />

            <LinkInterface editor={editor} />

            {!props.markdown && (
              <>
                <Divider orientation='vertical' mt={3} mb={3} />

                <Popover
                  position='top'
                  shadow='lg'
                  withinPortal
                  withArrow
                  trapFocus
                >
                  <Popover.Target>
                    <ActionIcon>
                      <Palette size={18} />
                    </ActionIcon>
                  </Popover.Target>
                  <Popover.Dropdown>
                    <ColorPicker
                      swatchesPerRow={7}
                      swatches={PRESET_COLORS}
                      value={editor.getAttributes('textStyle').color}
                      onChange={(value) => editor
                        .chain()
                        .focus()
                        .setColor(value)
                        .setTextSelection(editor.state.selection.to)
                        .run()
                      }
                    />
                  </Popover.Dropdown>
                </Popover>

                {editor.getAttributes('textStyle')?.color && (
                  <Tooltip
                    label='Reset Color'
                    position='top'
                    withArrow
                    openDelay={500}
                    sx={(theme) => ({ backgroundColor: theme.colors.dark[9] })}
                  >
                    <ActionIcon onClick={() => editor
                      .chain()
                      .focus()
                      .unsetColor()
                      .setTextSelection(editor.state.selection.to)
                      .run()
                    }>
                      <PaletteOff size={18} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </>
            )}

            <div style={{ flexGrow: 1 }} />

            {props.rightSection}
          </Group>
        </Box>
      )}
      <Group spacing={2} sx={(theme) => ({
        padding: 2,
        backgroundColor: theme.colors.dark[6],
        border: `1px solid ${theme.colors.dark[4]}`,
        ...(variant === 'full' ? {
          borderTop: 'none',
          borderBottomLeftRadius: 3,
          borderBottomRightRadius: 3,
        } : {
          borderRadius: 3,
        }),
      })}>
        <ScrollArea.Autosize mah={props.maxHeight || '60ch'} sx={{
          flexGrow: 1,
          margin: '0.35rem 0.1rem 0.3rem 0.6rem',
        }}>
          <EditorContent className={classes.typography} editor={editor} />
        </ScrollArea.Autosize>

        {variant === 'minimal' && props.rightSection}
      </Group>
    </Box>
  );
}


////////////////////////////////////////////////////////////
const INDENT = '  ';

////////////////////////////////////////////////////////////
function addMarkTag(md: string, mark: string, link: string) {
  if (mark === 'italic') md += '*';
  else if (mark === 'bold') md += '**';
  else if (mark === 'strike') md += '~~';
  else if (mark === 'code') md += '`';
  else if (mark === 'subscript') md += '~';
  else if (mark === 'superscript') md += '^';
  else if (mark === 'link') {
    if (link)
      md += `](${link})`;
    else
      md += '[';
  }

  return md;
}

////////////////////////////////////////////////////////////
function addMarks(md: string, on: string[], off: string[], marks: Record<string, number>, link: string): string {
  // Handle off first, sort by mark start position
  off.sort((a, b) => marks[b] - marks[a]);

  for (const m of off) {
    marks[m] = -1;
    md = addMarkTag(md, m, link);
  }
  
  for (const m of on) {
    marks[m] = md.length;
    md = addMarkTag(md, m, '');
  }

  return md;
}

////////////////////////////////////////////////////////////
function addIndent(text: string, first: boolean = true): string {
  return (first ? INDENT : '') + text.replaceAll(/\n( *\S)/g, (match, keep) => `\n${INDENT}${keep}`);
}

////////////////////////////////////////////////////////////
function addBlockquote(text: string): string {
  return '>' + text.replaceAll('\n', '\n>');
}

////////////////////////////////////////////////////////////
function makeParagraph(node: JSONContent) {
  if (!node.content) return '';

  // Construct paragraph string
  const marks: Record<string, number> = {};
  let link = '';
  let text = '';

  for (const doc of node.content) {
    const { type } = doc;

    if (type === 'text') {
      // Find which marks are turning on/off
      const newMarks = new Set<string>((doc.marks || []).map(x => x.type));
      const on: string[] = [];
      const off: string[] = [];
  
      for (const m of Array.from(newMarks)) {
        if (marks[m] === undefined || marks[m] < 0) {
          on.push(m);

          // Save link
          if (m === 'link') {
            link = (doc.marks || []).find(x => x.type === 'link')?.attrs?.href || '';
          }
        }
      }
  
      for (const m of Object.keys(marks)) {
        if (!newMarks.has(m))
          off.push(m);
      }
  
      // Add text marks
      text = addMarks(text, on, off, marks, link);
  
      // Add actual text
      text += doc.text;
    }

    else if (type === 'hardBreak') {
      text += '\n';
    }

    else if (type === 'pingMention') {
      const parts = doc.attrs?.id.split(':') || ['profiles', ''];
      let brackets = config.app.message.member_mention_chars;
      if (parts[0] === 'roles')
        brackets = config.app.message.role_mention_chars;

      text += `@${brackets[0]}${parts[1]}${brackets[1]}`;
    }
  }

  // Finish marks
  const off: string[] = [];
  for (const [m, index] of Object.entries(marks)) {
    if (index >= 0)
      off.push(m);
  }
  text = addMarks(text, [], off, marks, link);

  return text;
}

////////////////////////////////////////////////////////////
function makeListItem(node: JSONContent, type: 'ordered' | 'unordered', index: number): string {
  if (node.type !== 'listItem' || !node.content) return '';

  let text = type === 'ordered' ? index + '. ' : '- ';

  // Parse all children into unindented string
  let content = makeDocument(node);

  // Indent all other content
  text += addIndent(content, false);

  return text;
}

////////////////////////////////////////////////////////////
function makeList(node: JSONContent): string {
  if (node.type !== 'bulletList' && node.type !== 'orderedList' || !node.content) return '';

  // Construct bullet list text
  let text = '';
  let number = node.attrs?.start || 1;

  for (const n of node.content) {
    if (n.type === 'listItem') {
      text += makeListItem(n, node.type === 'bulletList' ? 'unordered' : 'ordered', number++) + '\n';
    }
  }

  return text;
}

////////////////////////////////////////////////////////////
function makeBlockquote(node: JSONContent): string {
  if (node.type !== 'blockquote' || !node.content) return '';

  // Parse all contents and add blockquote
  return addBlockquote(makeDocument(node));
}

////////////////////////////////////////////////////////////
function makeCodeBlock(node: JSONContent): string {
  if (node.type !== 'codeBlock' || !node.content) return '';
  return '```' + (node.attrs?.language || '') + '\n' + makeParagraph(node) + '\n```';
}

////////////////////////////////////////////////////////////
function makeHeading(node: JSONContent): string {
  if (node.type !== 'heading' || !node.content) return '';
  return '#'.repeat(node.attrs?.level || 1) + ' ' + makeParagraph(node);
}

////////////////////////////////////////////////////////////
function makeDocument(node: JSONContent): string {
  if (!node.content) return '';

  // Add inner contents
  let text = '';

  for (const n of node.content) {
    const { type } = n;

    if (type === 'paragraph') {
      text += makeParagraph(n) + '\n\n';
    }
    else if (type === 'bulletList' || type === 'orderedList') {
      text += makeList(n) + '\n';
    }
    else if (type === 'blockquote') {
      text += makeBlockquote(n) + '\n\n';
    }
    else if (type === 'codeBlock') {
      text += makeCodeBlock(n) + '\n\n';
    }
    else if (type === 'heading') {
      text += makeHeading(n) + '\n\n';
    }
    else if (type === 'horizontalRule') {
      text += '---\n\n';
    }
  }

  return text.trim();
}

////////////////////////////////////////////////////////////
export function toMarkdown(editor: Editor): string {
  return makeDocument(editor.getJSON());
}