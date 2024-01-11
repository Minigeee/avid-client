import {
  PropsWithChildren,
  MutableRefObject,
  useEffect,
  useImperativeHandle,
  useState,
  forwardRef,
  useRef,
  RefObject,
  useCallback,
  useMemo,
  CSSProperties,
} from 'react';

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
  Sx,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';

import {
  IconBold,
  IconDotsVertical,
  IconH1,
  IconH2,
  IconH3,
  IconH4,
  IconItalic,
  IconLink,
  IconList,
  IconListNumbers,
  IconPalette,
  IconPaletteOff,
  IconPhoto,
  IconPhotoPlus,
  IconStrikethrough,
  IconSubscript,
  IconSuperscript,
  IconUnderline,
} from '@tabler/icons-react';

import {
  BubbleMenu,
  Editor,
  EditorContent,
  EditorOptions,
  Extension,
  FloatingMenu,
  JSONContent,
  useEditor,
} from '@tiptap/react';
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
import ImageExtension from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';

import { Emojis } from './Emojis';
import PingMention from './PingMention';

import config from '@/config';
import {
  DomainWrapper,
  useCachedState,
  useChatStyles,
  useDocumentStyles,
  useSession,
  useTimeout,
} from '@/lib/hooks';

import { uid } from 'uid';
import { IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { ExpandedMember, FileAttachment } from '@/lib/types';
import { emojiSearch } from '@/lib/utility/emoji';
import { useForm } from '@mantine/form';

////////////////////////////////////////////////////////////
const PRESET_COLORS: string[] = [];
for (const [name, colors] of Object.entries(DEFAULT_THEME.colors)) {
  if (name === 'red' || name === 'gray' || name === 'yellow' || name === 'lime')
    PRESET_COLORS.push(colors[7]);
  else if (name !== 'dark') PRESET_COLORS.push(colors[6]);
}
PRESET_COLORS.push(DEFAULT_THEME.colors.gray[6]);

////////////////////////////////////////////////////////////
type EditorButtonProps = PropsWithChildren & {
  active?: boolean;
  tooltip?: string;
  onClick?: () => unknown;
};

////////////////////////////////////////////////////////////
function EditorButton({ active, tooltip, ...props }: EditorButtonProps) {
  return (
    <Tooltip label={tooltip || ''} position='top' withArrow openDelay={500}>
      <ActionIcon
        sx={(theme) => ({
          background: active ? theme.other.elements.rte_active : undefined,
          color: theme.other.elements.rte_icon,
          '&:hover': {
            background: active
              ? theme.other.elements.rte_active
              : theme.other.elements.rte_hover,
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
  const form = useForm({
    initialValues: {
      title: '',
      link: '',
    },
  });

  function onSubmit({ title, link }: typeof form.values) {
    if (editor && title && link) {
      const start = editor.state.selection.from;

      editor
        .chain()
        .focus()
        .insertContent(title + ' ')
        .setTextSelection({ from: start, to: start + title.length })
        .setLink({ href: (link.startsWith('http') ? '' : 'https://') + link })
        .setTextSelection(start + title.length + 1)
        .run();
    }

    form.reset();
    setOpened(false);
  }

  // Does selection have link
  const hasLink = editor?.isActive('link');

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
      <Tooltip
        label={hasLink ? 'Remove Link' : 'Insert Link'}
        position='top'
        withArrow
        openDelay={500}
      >
        <Popover.Target>
          <ActionIcon
            sx={(theme) => ({
              color: theme.other.elements.rte_icon,
              background: hasLink ? theme.other.elements.rte_active : undefined,
              '&:hover': {
                background: theme.other.elements.rte_hover,
              },
            })}
            onClick={() => {
              if (hasLink) {
                editor?.chain().focus().unsetLink().run();
              } else {
                setOpened(!opened);

                // Set default title
                const selection = editor?.view.state.selection;
                if (selection && selection.from !== selection.to)
                  form.setFieldValue('title',
                    editor.state.doc.textBetween(selection.from, selection.to),
                  );
              }
            }}
          >
            <IconLink size={18} />
          </ActionIcon>
        </Popover.Target>
      </Tooltip>

      <Popover.Dropdown>
        <form onSubmit={form.onSubmit(onSubmit)}>
          <Stack spacing='xs'>
            <TextInput
              label='Link'
              placeholder='https://www.your-link.com'
              required
              withAsterisk={false}
              {...form.getInputProps('link')}
              onChange={(e) => {
                const value = e.currentTarget.value;
                form.setFieldValue('link', value);
                if (!form.isTouched('title')) form.setFieldValue('title', value);
              }}
            />
            <TextInput
              label='Title'
              placeholder='Link title'
              required
              withAsterisk={false}
              {...form.getInputProps('title')}
            />

            <Button variant='gradient' type='submit' mt={4}>
              Insert Link
            </Button>
          </Stack>
        </form>
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
      addNewline: () => ReturnType;
    };
  }
}

////////////////////////////////////////////////////////////
const CustomBulletList = BulletList.extend({
  addKeyboardShortcuts() {
    return {
      Tab: () => true,
    };
  },
});

////////////////////////////////////////////////////////////
const CustomOrderedList = OrderedList.extend({
  addKeyboardShortcuts() {
    return {
      Tab: () => true,
    };
  },
});

////////////////////////////////////////////////////////////
export type RichTextEditorProps = {
  editorRef?: MutableRefObject<Editor | null | undefined>;

  // UI
  variant?: 'minimal' | 'full' | 'inline';
  toolbarVariant?: 'default' | 'document';
  placeholder?: string;
  autofocus?: boolean;
  markdown?: boolean;
  leftSection?: JSX.Element;
  leftWidth?: MantineNumberSize;
  rightSection?: JSX.Element;
  floatingMenu?: JSX.Element;
  maxCharacters?: number;
  maxWidth?: string | number;
  maxHeight?: string | number;
  focusRing?: boolean;
  /** Allow inline images (default false) */
  image?: boolean;
  /** Allow youtube embeds (default false) */
  youtube?: boolean;
  textStyle?: 'default' | 'document';
  editorStyle?: Sx;

  domain?: DomainWrapper;
  members?: Pick<ExpandedMember, 'id' | 'alias' | 'profile_picture'>[];

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
};

////////////////////////////////////////////////////////////
type _Funcs = {
  handleKeyDown: EditorOptions['editorProps']['handleKeyDown'];
  handlePaste: EditorOptions['editorProps']['handlePaste'];
  handleTextInput: EditorOptions['editorProps']['handleTextInput'];
};

/** Get dimensions of image file */
async function _getImageDims(
  f: File,
): Promise<{ width: number; height: number }> {
  return new Promise((res) => {
    const fr = new FileReader();

    fr.onload = function () {
      // file is loaded
      const img = new Image();

      img.onload = function () {
        res({ width: img.width, height: img.height });
      };

      if (typeof fr.result === 'string') img.src = fr.result; // is the data URL because called with readAsDataURL
    };

    fr.readAsDataURL(f);
  });
}

////////////////////////////////////////////////////////////
function useFunctions(
  props: RichTextEditorProps,
  setAttachments: ((files: FileAttachment[]) => Promise<void>) | undefined,
) {
  // Ref for keeping updated function versions
  const funcsRef = useRef<Partial<_Funcs>>({});

  // Paste handler
  useEffect(() => {
    funcsRef.current.handlePaste = (view, event, slice) => {
      // Don't handle anything if no attachments storage
      if (!setAttachments) return false;

      // Async handler
      const renameImgs = async (files: Record<number, FileAttachment>) => {
        // Get items to get image text
        const items = Array.from(event.clipboardData?.items || []);
        for (let i = 0; i < items.length; ++i) {
          const item = items[i];

          if (item.type === 'text/html') {
            // Get html
            const html: string = await new Promise((res) => {
              items[0].getAsString((e) => {
                res(e);
              });
            });

            // Check if there is an image source
            const srcMatch = html.match(/src\s*=\s*"(.+?)"/);
            const altMatch = html.match(/alt\s*=\s*"(.+?)"/);
            const file = files[i + 1]?.file;

            if (srcMatch && file) {
              // Rename file
              const fname = (
                srcMatch[1].split('/').at(-1) || 'image.png'
              ).split('.')[0];

              files[i + 1] = {
                type: 'image',
                file: new File([file], `${fname}.png`, {
                  type: file.type,
                }),
                alt: altMatch?.[1] || undefined,
              };
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
        const files: Record<number, FileAttachment> = {};
        let hasRename = false;

        for (let i = 0; i < items.length; ++i) {
          const item = items[i];

          if (item.kind === 'file') {
            // TODO : Support non image attachments
            if (!item.type.startsWith('image')) continue;

            let file = item.getAsFile();
            if (file) files[i] = { file, type: 'image' };
          } else if (item.type === 'text/html') hasRename = true;
        }

        // Rename images asynchronously if there are any renames
        if (hasRename) renameImgs(files);
        // Add all images
        else setAttachments(Object.values(files));

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
    else funcsRef.current.handleKeyDown = undefined;
  }, [props.onKey]);

  // Handle text input
  useEffect(() => {
    // Disable func if callbacks not given
    if (!props.typingTimeout) {
      funcsRef.current.handleTextInput = undefined;
    } else {
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

/** Tool bar for rte */
function RteToolbar({
  editor,
  ...props
}: { editor: Editor } & Pick<
  RichTextEditorProps,
  'markdown' | 'rightSection' | 'toolbarVariant'
>) {
  const [expanded, setExpanded] = useState<boolean>(false);

  return (
    <>
      <Group spacing={2} noWrap>
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

        {props.toolbarVariant !== 'document' && (
          <>
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
          </>
        )}

        {props.toolbarVariant === 'document' && (
          <>
            <Divider orientation='vertical' mt={3} mb={3} />

            <EditorButton
              tooltip='Title'
              active={editor.isActive('heading', { level: 1 })}
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              }
            >
              <IconH1 size={18} />
            </EditorButton>
            <EditorButton
              tooltip='Header'
              active={editor.isActive('heading', { level: 2 })}
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
            >
              <IconH2 size={18} />
            </EditorButton>
            <EditorButton
              tooltip='Subheader'
              active={editor.isActive('heading', { level: 3 })}
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 3 }).run()
              }
            >
              <IconH3 size={18} />
            </EditorButton>
          </>
        )}

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
              <Tooltip label='Color' position='top' withArrow openDelay={500}>
                <Popover.Target>
                  <ActionIcon
                    sx={(theme) => ({
                      color: theme.other.elements.rte_icon,
                      '&:hover': {
                        background: theme.other.elements.rte_hover,
                      },
                    })}
                  >
                    <IconPalette size={18} />
                  </ActionIcon>
                </Popover.Target>
              </Tooltip>

              <Popover.Dropdown>
                <ColorPicker
                  swatchesPerRow={7}
                  swatches={PRESET_COLORS}
                  value={editor.getAttributes('textStyle').color}
                  onChange={(value) =>
                    editor
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
              >
                <ActionIcon
                  sx={(theme) => ({
                    color: theme.other.elements.rte_icon,
                    '&:hover': {
                      background: theme.other.elements.rte_hover,
                    },
                  })}
                  onClick={() =>
                    editor
                      .chain()
                      .focus()
                      .unsetColor()
                      .setTextSelection(editor.state.selection.to)
                      .run()
                  }
                >
                  <IconPaletteOff size={18} />
                </ActionIcon>
              </Tooltip>
            )}
          </>
        )}

        {props.toolbarVariant === 'document' && (
          <>
            <Divider orientation='vertical' mt={3} mb={3} />

            <EditorButton
              tooltip='More Options'
              active={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              <IconDotsVertical size={18} />
            </EditorButton>
          </>
        )}

        <div style={{ flexGrow: 1 }} />

        {props.rightSection}
      </Group>

      {expanded && props.toolbarVariant === 'document' && (
        <Group spacing={2} mt={4}>
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
        </Group>
      )}
    </>
  );
}

////////////////////////////////////////////////////////////
export default function RichTextEditor(props: RichTextEditorProps) {
  const variant = props.variant || 'full';

  const session = useSession();
  const { classes } = (
    props.textStyle === 'document' ? useDocumentStyles : useChatStyles
  )();

  // Set attachments
  const setAttachments = useCallback(
    async (files: FileAttachment[]) => {
      // If any files are default named, assign them a random uid
      for (let i = 0; i < files.length; ++i) {
        const attachment = files[i];
        if (attachment.file.name === 'image.png')
          files[i].file = new File([attachment.file], `${uid(16)}.png`, {
            type: attachment.file.type,
          });
      }

      // Construct file attachment objects
      const fileAttachments: FileAttachment[] = [];
      for (const attachment of files) {
        if (attachment.type === 'image') {
          const dims = await _getImageDims(attachment.file);
          fileAttachments.push({ ...attachment, ...dims });
        }

        // Default attachment
        else {
          fileAttachments.push(attachment);
        }
      }

      // Add all files
      props.onAttachmentsChange?.(
        (props.attachments || []).concat(fileAttachments),
      );
    },
    [props.attachments],
  );

  // Editor handler functions
  const funcsRef = useFunctions(
    props,
    props.onAttachmentsChange ? setAttachments : undefined,
  );

  // New extension for each instance bc shared storage for some reason
  const CustomNewline = useMemo(
    () =>
      Extension.create<{}, { onEnter: (() => boolean) | null }>({
        name: 'newline',
        // priority: 1000,
        addStorage() {
          return {
            onEnter: null,
          };
        },
        addKeyboardShortcuts() {
          return {
            Enter: () =>
              this.storage.onEnter ? this.storage.onEnter() : false,
          };
        },
      }),
    [],
  );

  // Editor
  const editor = useEditor({
    extensions: [
      CustomNewline,
      BulletList,
      CharacterCount.configure({ limit: props.maxCharacters }),
      Color,
      Emojis,
      Link.configure({ openOnClick: false }),
      ...(props.domain?._exists || props.members
        ? [
            PingMention.configure({
              session,
              domain: props.domain,
              members: props.members,
            }),
          ]
        : []),
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
      ...(props.image ? [ImageExtension] : []),
      ...(props.youtube ? [Youtube] : []),
    ],
    content: props.value,
    onUpdate: ({ editor }) => {
      if (props.onChange) props.onChange(editor.getHTML());
    },
    autofocus: props.autofocus || false,

    editorProps: {
      handleKeyDown: (view, event) => {
        return funcsRef.current.handleKeyDown?.(view, event);
      },
      handlePaste: (view, event, slice) => {
        return funcsRef.current.handlePaste?.(view, event, slice);
      },
      handleTextInput: (view, from, to, text) => {
        return funcsRef.current.handleTextInput?.(view, from, to, text);
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
    } else {
      editor.storage.newline.onEnter = undefined;
    }
  }, [editor, props.onSubmit, variant]);

  // Handle attachment previews render (without memo this, the image would rerender from file every time input changed)
  const previews = useMemo(
    () =>
      props.attachments?.map((f, i) => {
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
                    background: theme.other.elements.rte_panel,
                    borderRadius: theme.radius.sm,
                  },
                  imageWrapper: { background: theme.colors.dark[0] },
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
      }),
    [props.attachments],
  );

  if (props.editorRef) props.editorRef.current = editor;

  if (!editor) return null;

  return (
    <Box
      sx={(theme) => ({
        width: '100%',
        maxWidth: props.maxWidth,

        '.ProseMirror': {
          ...(typeof props.editorStyle === 'function'
            ? props.editorStyle(theme)
            : props.editorStyle),

          '&:focus': {
            outline: 'none',
          },
          '.is-editor-empty': {
            ':first-child': {
              '::before': {
                color: theme.other.elements.rte_dimmed,
                content: 'attr(data-placeholder)',
                float: 'left',
                height: 0,
                pointerEvents: 'none',
                fontSize: props.textStyle === 'document' ? 16 : 14,
              },
            },
          },
        },

        border:
          props.variant === 'inline'
            ? undefined
            : `1px solid ${theme.other.elements.rte_border}`,
        borderRadius: 3,
        overflow: 'hidden',
        '&:focus-within':
          props.focusRing === false
            ? undefined
            : {
                border: `1px solid ${
                  theme.colors[theme.primaryColor][theme.primaryShade as number]
                }`,
              },

        position: 'relative',
      })}
    >
      {props.onAttachmentsChange && (
        <input
          ref={props.fileInputRef}
          type='file'
          accept={IMAGE_MIME_TYPE.join(',')}
          onChange={(event) => {
            // Add all chosen files
            // TODO : Support non image files
            if (event.target.files)
              setAttachments(
                Array.from(event.target.files).map((f) => ({
                  file: f,
                  type: 'image',
                })),
              );
          }}
          style={{ display: 'none' }}
        />
      )}

      {variant === 'full' && (
        <Box
          sx={(theme) => ({
            padding: '0.35rem 0.55rem',
            background: theme.other.elements.rte_header,
          })}
        >
          <RteToolbar
            editor={editor}
            markdown={props.markdown}
            rightSection={props.rightSection}
            toolbarVariant={props.toolbarVariant}
          />
        </Box>
      )}
      {previews && previews.length > 0 && (
        <Group
          sx={(theme) => ({
            padding: '0.5rem',
            borderBottom: `1px solid ${theme.other.elements.rte_border}`,
          })}
        >
          {previews}
        </Group>
      )}
      <Flex
        wrap='nowrap'
        gap={2}
        sx={(theme) => ({
          padding: 2,
          background: theme.other.elements.rte,
        })}
      >
        {variant === 'minimal' && props.leftSection}

        {variant === 'inline' && (
          <Box sx={{ flexGrow: 1 }}>
            <BubbleMenu
              editor={editor}
              updateDelay={100}
              tippyOptions={{ duration: 100, placement: 'bottom-start' }}
            >
              <Box
                sx={(theme) => ({
                  padding: '0.25rem',
                  background: theme.other.elements.rte_header,
                  border: `1px solid ${theme.other.elements.rte_border}`,
                  borderRadius: theme.radius.sm,
                  boxShadow: theme.shadows.sm,
                })}
              >
                <RteToolbar
                  editor={editor}
                  markdown={props.markdown}
                  rightSection={props.rightSection}
                  toolbarVariant={props.toolbarVariant}
                />
              </Box>
            </BubbleMenu>

            {props.floatingMenu !== undefined && (
              <FloatingMenu
                editor={editor}
                tippyOptions={{ duration: 100, placement: 'left' }}
              >
                <Box
                  sx={(theme) => ({
                    padding: '0.25rem',
                    background: theme.other.elements.rte_header,
                    color: theme.other.elements.rte_icon,
                    border: `1px solid ${theme.other.elements.rte_border}`,
                    borderRadius: theme.radius.sm,
                    boxShadow: theme.shadows.sm,

                    button: {
                      '&:hover': {
                        background: theme.other.elements.rte_hover,
                      },
                    },
                  })}
                >
                  {props.floatingMenu}
                </Box>
              </FloatingMenu>
            )}

            <EditorContent className={classes.typography} editor={editor} />
          </Box>
        )}

        {variant !== 'inline' && (
          <ScrollArea.Autosize
            mah={props.maxHeight || '60ch'}
            sx={{
              flexGrow: 1,
              margin: '0.35rem 0.1rem 0.3rem 0.6rem',
            }}
          >
            <EditorContent className={classes.typography} editor={editor} />
          </ScrollArea.Autosize>
        )}

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
    if (link) md += `](${link})`;
    else md += '[';
  }

  return md;
}

////////////////////////////////////////////////////////////
function addMarks(
  md: string,
  on: string[],
  off: string[],
  marks: Record<string, number>,
  link: string,
): string {
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
  return (
    (first ? INDENT : '') +
    text.replaceAll(/\n( *\S)/g, (match, keep) => `\n${INDENT}${keep}`)
  );
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
      const newMarks = new Set<string>((doc.marks || []).map((x) => x.type));
      const on: string[] = [];
      const off: string[] = [];

      for (const m of Array.from(newMarks)) {
        if (marks[m] === undefined || marks[m] < 0) {
          on.push(m);

          // Save link
          if (m === 'link') {
            link =
              (doc.marks || []).find((x) => x.type === 'link')?.attrs?.href ||
              '';
          }
        }
      }

      for (const m of Object.keys(marks)) {
        if (!newMarks.has(m)) off.push(m);
      }

      // Add text marks
      text = addMarks(text, on, off, marks, link);

      // Add actual text
      text += doc.text;
    } else if (type === 'hardBreak') {
      text += '\n';
    } else if (type === 'pingMention') {
      const parts = doc.attrs?.['data-id'].split(':') || ['profiles', ''];
      let brackets = config.app.message.member_mention_chars;
      if (parts[0] === 'roles')
        brackets = config.app.message.role_mention_chars;

      text += `@${brackets[0]}${parts[1]}${brackets[1]}`;
    } else if (type === 'emojis') {
      const id = doc.attrs?.['emoji-id'] || '';
      const native = doc.attrs?.['data-emoji-set'] === 'native';
      console.log(doc.attrs);

      if (native) {
        const emoji = emojiSearch.get(id);
        text += emoji ? emoji.skins[0].native : `:${id}:`;
      } else text += `:${id}:`;
    }
  }

  // Finish marks
  const off: string[] = [];
  for (const [m, index] of Object.entries(marks)) {
    if (index >= 0) off.push(m);
  }
  text = addMarks(text, [], off, marks, link);

  return text;
}

////////////////////////////////////////////////////////////
function makeListItem(
  node: JSONContent,
  type: 'ordered' | 'unordered',
  index: number,
): string {
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
  if (
    (node.type !== 'bulletList' && node.type !== 'orderedList') ||
    !node.content
  )
    return '';

  // Construct bullet list text
  let text = '';
  let number = node.attrs?.start || 1;

  for (const n of node.content) {
    if (n.type === 'listItem') {
      text +=
        makeListItem(
          n,
          node.type === 'bulletList' ? 'unordered' : 'ordered',
          number++,
        ) + '\n';
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
  return (
    '```' + (node.attrs?.language || '') + '\n' + makeParagraph(node) + '\n```'
  );
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
    } else if (type === 'bulletList' || type === 'orderedList') {
      text += makeList(n) + '\n';
    } else if (type === 'blockquote') {
      text += makeBlockquote(n) + '\n\n';
    } else if (type === 'codeBlock') {
      text += makeCodeBlock(n) + '\n\n';
    } else if (type === 'heading') {
      text += makeHeading(n) + '\n\n';
    } else if (type === 'horizontalRule') {
      text += '---\n\n';
    }
  }

  return text.trim();
}

////////////////////////////////////////////////////////////
export function toMarkdown(editor: Editor): string {
  return makeDocument(editor.getJSON());
}
