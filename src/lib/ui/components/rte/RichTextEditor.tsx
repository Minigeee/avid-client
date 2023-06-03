import { PropsWithChildren, MutableRefObject, useEffect, useImperativeHandle, useState, forwardRef, useRef, RefObject, useCallback, useMemo } from 'react';

import {
  ActionIcon,
  Box,
  Button,
  CloseButton,
  ColorPicker,
  DEFAULT_THEME,
  Divider,
  Flex,
  Group,
  Image as MantineImage,
  MantineNumberSize,
  Popover,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';

import {
  IconBold,
  IconItalic,
  IconLink,
  IconList,
  IconListNumbers,
  IconPalette,
  IconPaletteOff,
  IconStrikethrough,
  IconSubscript,
  IconSuperscript,
  IconUnderline,
} from '@tabler/icons-react';

import { useEditor, Editor, EditorContent, EditorOptions, Extension, ReactRenderer, JSONContent } from '@tiptap/react';
import BulletList from '@tiptap/extension-bullet-list';
import CharacterCount from '@tiptap/extension-character-count';
import Color from '@tiptap/extension-color';
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
import { DomainWrapper, useChatStyles, useSession, useTimeout } from '@/lib/hooks';

import { uid } from 'uid';
import { IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { FileAttachment } from '@/lib/types';


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
  editorRef?: MutableRefObject<Editor | null | undefined>;

  // UI
  variant?: 'minimal' | 'full' | 'inline';
  placeholder?: string;
  autofocus?: boolean;
  markdown?: boolean;
  leftSection?: JSX.Element;
  leftWidth?: MantineNumberSize;
  rightSection?: JSX.Element;
  maxCharacters?: number;
  maxWidth?: string | number;
  maxHeight?: string | number;
  focusRing?: boolean;

  domain?: DomainWrapper;

  // Text
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  onKey?: (e: KeyboardEvent) => boolean;

  // Typing
  onStartTyping?: () => void;
  typingTimeout?: ReturnType<typeof useTimeout>;

  // Attachments
  fileInputRef?: RefObject<HTMLInputElement>;
  attachments?: FileAttachment[];
  onAttachmentsChange?: (files: FileAttachment[]) => void;
}


////////////////////////////////////////////////////////////
type _Funcs = {
  handleKeyDown: EditorOptions['editorProps']['handleKeyDown'];
  handlePaste: EditorOptions['editorProps']['handlePaste'];
  handleTextInput: EditorOptions['editorProps']['handleTextInput'];
};

/** Get dimensions of image file */
async function _getImageDims(f: File): Promise<{ width: number; height: number }> {
	return new Promise(res => {
		const fr = new FileReader;

		fr.onload = function () { // file is loaded
			const img = new Image;

			img.onload = function () {
				res({ width: img.width, height: img.height });
			};

			if (typeof fr.result === 'string')
				img.src = fr.result; // is the data URL because called with readAsDataURL
		};

		fr.readAsDataURL(f);
	});
}

////////////////////////////////////////////////////////////
function useFunctions(props: RichTextEditorProps, setAttachments: (files: File[]) => Promise<void>) {
  // Ref for keeping updated function versions
  const funcsRef = useRef<Partial<_Funcs>>({});


  // Paste handler
  useEffect(() => {
    funcsRef.current.handlePaste = (view, event, slice) => {
      // Don't handle anything if no attachments storage
      if (!props.onAttachmentsChange) return false;

      // Async handler
      const renameImgs = async (files: Record<number, File>) => {
        // Get items to get image text
        const items = Array.from(event.clipboardData?.items || []);
        for (let i = 0; i < items.length; ++i) {
          const item = items[i];

          if (item.type === 'text/html') {
            // Get html
            const html: string = await new Promise(res => {
              items[0].getAsString(e => {
                res(e);
              });
            });

            // Check if there is an image source
            const match = html.match(/src\s*=\s*"(.+?)"/);
            const file = files[i + 1];
            if (match && file) {
              // Rename file
              const fname = (match[1].split('/').at(-1) || 'image.png').split('.')[0];
              files[i + 1] = new File([file], `${fname}.png`, { type: file.type });
            }
          }
        }

        // Add all images
        setAttachments(Object.values(files));
      };

      // Handle file attachments
      if (event.clipboardData?.files.length) {
        // Get files
        const items = Array.from(event.clipboardData?.items || []);
        const files: Record<number, File> = {};
        let hasRename = false;

        for (let i = 0; i < items.length; ++i) {
          const item = items[i];

          if (item.kind === 'file') {
            // TODO : Support non image attachments
            if (!item.type.startsWith('image')) continue;

            let file = item.getAsFile();
            if (file)
              files[i] = file;
          }

          else if (item.type === 'text/html')
            hasRename = true;
        }

        // Rename images asynchronously if there are any renames
        if (hasRename)
          renameImgs(files);
        else
          // Add all images
          setAttachments(Object.values(files));

        return true;
      }

      // Not handled, use default behavior
      return false;
    };
  }, [props.attachments]);

  // Handle key down
  useEffect(() => {
    if (props.onKey)
      funcsRef.current.handleKeyDown = (view, e) => props.onKey?.(e) || false;
    else
      funcsRef.current.handleKeyDown = undefined;
  }, [props.onKey]);

  // Handle text input
  useEffect(() => {
    // Disable func if callbacks not given
    if (!props.typingTimeout) {
      funcsRef.current.handleTextInput = undefined;
    }
    else {
      funcsRef.current.handleTextInput = (view, from, to, text) => {
        if (!props.typingTimeout?.isActive) {
          // Send event if the timeout is not active (this means the user was not typing before)
          props.onStartTyping?.();
        }

        // Start new timer
        props.typingTimeout?.start();
      };
    }
  }, [props.onStartTyping, props.typingTimeout]);

  return funcsRef;
}


////////////////////////////////////////////////////////////
export default function RichTextEditor(props: RichTextEditorProps) {
  const variant = props.variant || 'full';

  const session = useSession();
  const { classes } = useChatStyles();


  // Set attachments
  const setAttachments = useCallback(async (files: File[]) => {
    // If any files are default named, assign them a random uid
    for (let i = 0; i < files.length; ++i) {
      const f = files[i];
      if (f.name === 'image.png')
        files[i] = new File([f], `${uid(16)}.png`, { type: f.type });
    }

    // Construct file attachment objects
    const fileAttachments: FileAttachment[] = [];
    for (const f of files) {
      if (f.type.startsWith('image')) {
        const dims = await _getImageDims(f);
        fileAttachments.push({ file: f, type: 'image', ...dims });
      }

      // Default attachment
      else {
        fileAttachments.push({ file: f, type: 'file' });
      }
    }

    // Add all files
    props.onAttachmentsChange?.((props.attachments || []).concat(fileAttachments));
  }, [props.attachments]);

  // Editor handler functions
  const funcsRef = useFunctions(props, setAttachments);


  // New extension for each instance bc shared storage for some reason
  const CustomNewline = useMemo(() => Extension.create<{}, { onEnter: (() => boolean) | null }>({
    name: 'newline',
    // priority: 1000,
    addStorage() {
      return {
        onEnter: null,
      };
    },
    addKeyboardShortcuts() {
      return {
        'Enter': () => this.storage.onEnter ? this.storage.onEnter() : false,
      };
    },
  }), []);

  // Editor
  const editor = useEditor({
    extensions: [
      CustomNewline,
      BulletList,
      CharacterCount.configure({ limit: props.maxCharacters }),
      Color,
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

    editorProps: {
      handleKeyDown: (view, event) => {
        funcsRef.current.handleKeyDown?.(view, event);
      },
      handlePaste: (view, event, slice) => {
        funcsRef.current.handlePaste?.(view, event, slice);
      },
      handleTextInput: (view, from, to , text) => {
        funcsRef.current.handleTextInput?.(view, from, to , text);
      },
    },
  });

  // Handle submit
  useEffect(() => {
    if (!editor) return;

    if (variant === 'minimal' && props.onSubmit) {
      editor.storage.newline.onEnter = () => {
        props.onSubmit?.();
        return true;
      };
    }
    else {
      editor.storage.newline.onEnter = undefined;
    }
  }, [editor, props.onSubmit, variant]);

  // Handle attachment previews render (without memo this, the image would rerender from file every time input changed)
  const previews = useMemo(() => props.attachments?.map((f, i) => {
    // Display image attachments as previews
    if (f.type === 'image') {
      const url = URL.createObjectURL(f.file);
      return (
        <Box key={f.file.name} sx={{ position: 'relative' }}>
          <MantineImage
            src={url}
            caption={f.file.name}
            styles={(theme) => ({
              root: {
                padding: '0.5rem 0.5rem 0.2rem 0.5rem',
                maxWidth: '18ch',
                backgroundColor: theme.colors.dark[7],
                borderRadius: theme.radius.sm,
              },
              imageWrapper: { backgroundColor: theme.colors.dark[0] },
              caption: {
                overflow: 'hidden',
                textAlign: 'left',
                textOverflow: 'ellipsis',
              },
            })}
          />
          <CloseButton
            variant='filled'
            color='red'
            size='sm'
            radius='lg'
            sx={{
              position: 'absolute',
              top: -5,
              right: -5,
            }}
            onClick={() => {
              const copy = props.attachments?.slice() || [];
              copy.splice(i, 1);
              props.onAttachmentsChange?.(copy);
            }}
          />
        </Box>
      );
    }

    // TODO : Handle other file attachments

    return null;
  }), [props.attachments]);

  if (props.editorRef)
    props.editorRef.current = editor;


  if (!editor) return (null);

  return (
    <Box sx={(theme) => ({
      width: '100%',
      maxWidth: props.maxWidth,

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

      border: `1px solid ${theme.colors.dark[4]}`,
      borderRadius: 3,
      overflow: 'hidden',
      '&:focus-within': props.focusRing === false ? undefined : {
        border: `1px solid ${theme.colors[theme.primaryColor][5]}`,
      },

      position: 'relative',
    })}>
      {props.attachments && props.onAttachmentsChange && (
        <input
          ref={props.fileInputRef}
          type='file'
          accept={IMAGE_MIME_TYPE.join(',')}
          onChange={(event) => {
            // Add all chosen files
            if (event.target.files)
              setAttachments(Array.from(event.target.files));
          }}
          style={{ display: 'none' }}
        />
      )}

      {variant === 'full' && (
        <Box sx={(theme) => ({
          padding: '0.35rem 0.55rem',
          backgroundColor: theme.colors.dark[8],
        })}>
          <Group spacing={2}>
            <EditorButton
              tooltip='Bold'
              active={editor?.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <IconBold size={18} />
            </EditorButton>
            <EditorButton
              tooltip='Italic'
              active={editor?.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <IconItalic size={18} />
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
              <IconStrikethrough size={18} />
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
              <IconList size={19} />
            </EditorButton>
            <EditorButton
              tooltip='Ordered List'
              active={editor?.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <IconListNumbers size={19} />
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
                      <IconPalette size={18} />
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
                      <IconPaletteOff size={18} />
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
      {previews && previews.length > 0 && (
        <Group sx={(theme) => ({
          padding: '0.5rem',
          backgroundColor: theme.colors.dark[6],
          borderBottom: `1px solid ${theme.colors.dark[5]}`
        })}>
          {previews}
        </Group>
      )}
      <Flex wrap='nowrap' gap={2} sx={(theme) => ({
        padding: 2,
        backgroundColor: theme.colors.dark[6],
      })}>
        {variant === 'minimal' && props.leftSection}

        <ScrollArea.Autosize mah={props.maxHeight || '60ch'} sx={{
          flexGrow: 1,
          margin: '0.35rem 0.1rem 0.3rem 0.6rem',
        }}>
          <EditorContent className={classes.typography} editor={editor} />
        </ScrollArea.Autosize>

        {variant === 'minimal' && props.rightSection}
      </Flex>
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
      const parts = doc.attrs?.['data-id'].split(':') || ['profiles', ''];
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