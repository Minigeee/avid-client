import {
  RefObject,
  createRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Image from 'next/image';

import {
  ActionIcon,
  Box,
  Button,
  Center,
  CloseButton,
  Flex,
  Group,
  Loader,
  Popover,
  ScrollArea,
  Select,
  Stack,
  Text,
  Tooltip,
  Transition,
  UnstyledButton,
  useMantineTheme,
} from '@mantine/core';
import { useInterval } from '@mantine/hooks';
import {
  IconBookmark,
  IconChevronsUp,
  IconCode,
  IconCopy,
  IconEye,
  IconList,
  IconPencil,
  IconPhotoPlus,
  IconUpload,
} from '@tabler/icons-react';

import RichTextEditor from '@/lib/ui/components/rte/RichTextEditor';
import { useConfirmModal } from '../../modals/ConfirmModal';

import { Attachment, Channel, FileAttachment } from '@/lib/types';
import {
  DomainWrapper,
  WikiWrapper,
  hasPermission,
  useApp,
  useCachedState,
  useCalendarEvents,
  useDocumentStyles,
  useSession,
  useWiki,
} from '@/lib/hooks';
import { socket } from '@/lib/utility/realtime';
import { events } from '@/lib/utility/events';

import { Editor } from '@tiptap/react';
import parseHtml, { Element, Text as DomText } from 'html-react-parser';
import assert from 'assert';
import { api, uploadAttachments } from '@/lib/api';
import {
  config as spacesConfig,
  getResourceUrl,
  getImageUrl,
  getResourceKey,
} from '@/lib/utility/spaces-util';
import ActionButton from '../../components/ActionButton';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneDark,
  oneLight,
} from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { startCase, throttle } from 'lodash';

////////////////////////////////////////////////////////////
type SubviewProps = WikiViewProps & {
  /** The wiki doc */
  wiki: WikiWrapper;
  /** Function called when change edit mode requested */
  setEditing: (value: boolean) => void;
};

/** Supported code languages */
const SUPPORTED_LANGUAGES = [
  { value: '', label: 'None' },
  ...SyntaxHighlighter.supportedLanguages.map((lang) => ({
    value: lang,
    label: startCase(lang),
  })),
];

/** Heading data */
type HeadingData = {
  ref: RefObject<HTMLHeadingElement>;
  index: number;
  visible: boolean;
};

/** Wiki official doc view */
function DocView({ wiki, ...props }: SubviewProps & { canEdit?: boolean }) {
  const viewportRef = useRef<HTMLDivElement>(null);

  // Styles
  const { classes } = useDocumentStyles();

  // In view draft mode?
  const [viewDraft, setViewDraft] = useState<boolean>(false);

  // Show scroll to top button
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);
  // Map of heading intersection states
  const headingDataRef = useRef<Record<string, HeadingData>>({});
  // Id of the current active heading
  const [activeHeading, setActiveHeading] = useState<string | null>(null);

  // Headings
  const headings = useMemo(() => {
    const content = !viewDraft ? wiki.content : wiki.draft;
    if (!content) return;

    const headerMatches = content.matchAll(/<h2.*>(.+)<\/h2>/g);
    const headings = Array.from(headerMatches).map((match) => ({
      title: match[1],
      id: match[1].toLocaleLowerCase().replaceAll(/\s+/g, '_'),
    }));

    return headings;
  }, [wiki.content, wiki.draft, viewDraft]);

  // Parse html string
  const docContents = useMemo(() => {
    // IMG DIMS
    const IMG_WIDTH = 800;

    // Map of heading refs
    const visibleHeadings = new Set(
      Object.entries(headingDataRef.current || {})
        .filter(([_, data]) => data.visible)
        .map(([id, _]) => id),
    );
    console.log(Array.from(visibleHeadings))
    headingDataRef.current = {};

    let headingIndex = 0;

    // Parse html
    const parsed = parseHtml(!viewDraft ? wiki.content : wiki.draft || '', {
      replace: (node) => {
        if (!(node instanceof Element)) return;

        // Map of attachments
        const attachments: Record<string, Attachment> = {};
        for (const entry of wiki.attachments || [])
          attachments[entry.url] = entry;

        if (node.name === 'img') {
          const key = getImageUrl(getResourceKey(node.attribs.src));
          const info = attachments[key];

          return (
            <Image
              src={key}
              width={IMG_WIDTH}
              height={
                (IMG_WIDTH * (info.height || IMG_WIDTH / 1.5)) /
                (info.width || IMG_WIDTH)
              }
              alt={
                node.attribs.alt ||
                info.alt ||
                node.attribs.file?.split('/').at(-1) ||
                'Image'
              }
            />
          );
        } else if (node.name === 'h2') {
          const child = node.firstChild;
          if (!(child instanceof DomText) || !child.data) return;

          const id = child.data.toLocaleLowerCase().replaceAll(/\s+/g, '_');
          const ref = createRef<HTMLHeadingElement>();

          // Add ref to map of refs
          headingDataRef.current[id] = {
            ref,
            index: headingIndex++,
            visible: visibleHeadings.has(id),
          };

          return (
            <h2 ref={ref} id={id}>
              {child.data}
            </h2>
          );
        } else if (node.name === 'pre') {
          const child = node.firstChild;
          if (!(child instanceof Element) || child.name !== 'code') return;
          if (!(child.firstChild instanceof DomText) || !child.firstChild.data)
            return;

          const lang = child.attribs.class?.split('language-')[1];
          const code = child.firstChild.data;

          return (
            <Box className='avid-pre' sx={{ position: 'relative' }}>
              <SyntaxHighlighter language={lang} style={oneLight}>
                {child.firstChild.data}
              </SyntaxHighlighter>

              <ActionButton
                tooltip='Copy'
                tooltipProps={{ position: 'left', openDelay: 500 }}
                sx={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                }}
                onClick={() => navigator.clipboard.writeText(code)}
              >
                <IconCopy size={16} />
              </ActionButton>
            </Box>
          );
        }
      },
    });

    // Return parsed
    return parsed;
  }, [wiki.content, wiki.draft, wiki.attachments, viewDraft]);

  // Used to set active heading
  useEffect(() => {
    // Heading observer
    const observer = new IntersectionObserver(
      (headings) => {
        if (headings.length === 0) return;

        // Toggle visiblities
        for (const elem of headings)
          headingDataRef.current[elem.target.id].visible =
            !headingDataRef.current[elem.target.id].visible;

        // Find top most visible heading
        let minIndex = 1000000;
        let minHeading = '';
        for (const [id, data] of Object.entries(headingDataRef.current)) {
          if (data.visible && data.index < minIndex) {
            minIndex = data.index;
            minHeading = id;
          }
        }

        if (minHeading)
          setActiveHeading(minHeading);
      },
      {
        rootMargin: '0px 0px 0px 0px',
      },
    );

    for (const [id, data] of Object.entries(headingDataRef.current)) {
      if (data.ref.current) observer.observe(data.ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // Called when scroll position changes
  const onScrollPosChange = useCallback(
    throttle(
      (e: { x: number; y: number }) => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        // Show scroll to bottom button if getting far from bottom
        if (e.y > 200) {
          if (!showScrollTop) setShowScrollTop(true);
        } else if (showScrollTop) setShowScrollTop(false);
      },
      50,
      { leading: false },
    ),
    [showScrollTop],
  );

  return (
    <>
      <ScrollArea
        viewportRef={viewportRef}
        onScrollPositionChange={onScrollPosChange}
        h='100%'
        w='100%'
      >
        <Flex pos='relative' w='85%' left='15%'>
          {headings && (
            <nav>
              <Box
                mr={40}
                sx={{
                  position: 'sticky',
                  top: '2.0rem',
                  marginTop: '8.0rem',
                  minWidth: '12rem',
                }}
              >
                <Group
                  spacing='sm'
                  noWrap
                  mb={8}
                  sx={(theme) => ({
                    color: theme.other.colors.paage_text,
                  })}
                >
                  <IconList size={20} />
                  <Text weight={600} size='md'>
                    Table of Contents
                  </Text>
                </Group>

                <ScrollArea.Autosize mah='calc(80vh - 8.0rem)'>
                  <Stack spacing={0}>
                    {headings.map((heading) => (
                      <UnstyledButton
                        component='a'
                        href={`#${heading.id}`}
                        sx={(theme) => ({
                          position: 'relative',
                          background:
                            activeHeading === heading.id
                              ? theme.other.colors.page_hover
                              : undefined,
                          borderRadius: theme.radius.sm,
                          overflow: 'hidden',
                          '&:hover': {
                            background: theme.other.colors.page_hover,
                          },
                        })}
                        onClick={(e) => {
                          e.preventDefault();
                          document
                            ?.querySelector(`#${heading.id}`)
                            ?.scrollIntoView({
                              behavior: 'smooth',
                            });
                        }}
                      >
                        <Flex>
                          {activeHeading === heading.id && (
                            <Box
                              sx={(theme) => ({
                                position: 'absolute',
                                width: '0.25rem',
                                height: '100%',
                                background: true
                                  ? theme.other.elements
                                      .channels_panel_highlight
                                  : undefined,
                              })}
                            />
                          )}

                          <Text
                            p='0.5rem 0.75rem'
                            size='sm'
                            sx={{ alignItems: 'center' }}
                          >
                            {heading.title}
                          </Text>
                        </Flex>
                      </UnstyledButton>
                    ))}
                  </Stack>
                </ScrollArea.Autosize>
              </Box>
            </nav>
          )}

          <Box
            className={classes.typography}
            sx={(theme) => ({
              padding: '6.0rem 0.0rem 8.0rem 0.0rem',
              marginRight: '2.0rem',
              width: '50rem',
              maxWidth: '100%',
            })}
          >
            {docContents}
          </Box>
        </Flex>
      </ScrollArea>

      {showScrollTop && (
        <ActionButton
          tooltip='Scroll To Top'
          tooltipProps={{ position: 'left', openDelay: 500 }}
          variant='filled'
          size='xl'
          radius='xl'
          sx={(theme) => ({
            position: 'absolute',
            bottom: '2.5rem',
            right: '3.0rem',
            background: theme.other.elements.scroll_button,
            color: theme.other.elements.scroll_button_icon,
            '&:hover': {
              background: theme.other.elements.scroll_button_hover,
            },
          })}
          onClick={() => {
            if (viewportRef.current) {
              viewportRef.current.scrollTo({
                top: 0,
              });
            }
          }}
        >
          <IconChevronsUp />
        </ActionButton>
      )}

      {props.canEdit && (
        <Group
          spacing='xs'
          sx={{
            position: 'absolute',
            top: '0.5rem',
            right: '1.0rem',
          }}
        >
          {viewDraft && (
            <Tooltip label='View Published'>
              <CloseButton
                size='lg'
                iconSize={24}
                sx={(theme) => ({
                  background: `${theme.other.colors.page}D0`,
                  '&:hover': {
                    background: theme.other.colors.page_hover,
                  },
                })}
                onClick={() => setViewDraft(false)}
              />
            </Tooltip>
          )}
          {wiki.draft && !viewDraft && (
            <Button
              variant='default'
              leftIcon={<IconEye size={16} />}
              onClick={() => setViewDraft(true)}
            >
              View Draft
            </Button>
          )}
          <Button
            variant='default'
            leftIcon={<IconPencil size={16} />}
            onClick={() => props.setEditing(true)}
          >
            Edit
          </Button>
        </Group>
      )}
    </>
  );
}

/** View for editing wiki doc */
function EditView({ wiki, ...props }: SubviewProps) {
  const session = useSession();
  const { open: openConfirmModal } = useConfirmModal();

  // Refs
  const editorRef = useRef<Editor>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Styles
  const { classes } = useDocumentStyles();
  // Loading
  const [loading, setLoading] = useState<boolean>(false);
  // Saved draft
  const [savedDraft, setSavedDraft] = useCachedState<string>(
    `${props.channel.id}/wiki.saved_draft`,
    '',
  );
  // Text for load notis
  const [loadingPopover, setLoadPopover] = useState<boolean>(false);

  // Lagged flag to save original draft
  const [lagged, setLagged] = useState<boolean>(false);
  // Original draft
  const [origDraft, setOrigDraft] = useCachedState<string>(
    `${props.channel.id}/wiki.orig_draft`,
    '',
  );

  // WIP : Split into "edit" and "doc" view, fix intersection: use single heading map with all data stored in ref, toggle visibility states of headings, set top most heading as active

  // Convenience function to leave edit mode
  const exitEditMode = () => {
    props.setEditing(false);
    setSavedDraft('');
    setOrigDraft('');
  };

  // Saving loop
  const saveInterval = useInterval(
    () => {
      if (!editorRef.current) return;
      const content = editorRef.current.getHTML();

      // Save draft
      if (wiki._exists && content !== origDraft) {
        wiki._mutators.updateWiki({
          draft: content,
        });
      }
    },
    2 * 60 * 1000,
  );

  // Detect when channel changes to save
  useEffect(() => {
    // Lagged flag
    setLagged(!lagged);

    // Event listener
    const id = events.on('channel-change', () => {
      if (!editorRef.current) return;
      const content = editorRef.current.getHTML();

      // Save draft
      if (wiki._exists && content !== origDraft) {
        wiki._mutators.updateWiki({
          draft: content,
        });
      }

      // Save locally
      setSavedDraft(content);
    });

    // Start saving interval
    saveInterval.start();

    return () => {
      events.off(id);
      saveInterval.stop();
    };
  }, []);

  // Save original draft
  useEffect(() => {
    if (!editorRef.current) return;
    setOrigDraft(editorRef.current.getHTML());
  }, [lagged]);

  // Function for uploading images
  const onAttachmentsChange = useCallback(
    async (files: FileAttachment[]) => {
      if (!editorRef.current || !wiki._exists) return;

      // Indicate loading
      setLoadPopover(true);

      try {
        // Upload images
        const uploads = await uploadAttachments(
          props.domain.id,
          files,
          session,
        );

        // Add images to doc
        for (const attachment of uploads) {
          if (attachment.type === 'image') {
            assert(attachment.base_url);
            editorRef.current
              .chain()
              .focus()
              .setImage({
                src: attachment.base_url,
                title: attachment.filename,
                alt: attachment.alt,
              })
              .run();
          }
        }

        // Add attachments to wiki
        wiki._mutators.updateWiki({ attachments: uploads });
      } finally {
        setLoadPopover(false);
      }
    },
    [wiki._exists],
  );

  // Floating toolbar
  const floatingMenu = useMemo(() => {
    return (
      <>
        <ActionButton
          tooltip='Add Image'
          tooltipProps={{
            openDelay: 500,
            position: 'left',
            withinPortal: true,
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <IconPhotoPlus size={16} />
        </ActionButton>
        <Popover position='bottom-start'>
          <Tooltip
            label='Code Block'
            openDelay={500}
            position='left'
            withinPortal
            withArrow
          >
            <Popover.Target>
              <ActionIcon
                onClick={() => {
                  //
                }}
              >
                <IconCode size={16} />
              </ActionIcon>
            </Popover.Target>
          </Tooltip>
          <Popover.Dropdown>
            <Select
              data={SUPPORTED_LANGUAGES}
              placeholder='Language'
              searchable
              onChange={(value) =>
                editorRef.current
                  ?.chain()
                  .focus()
                  .toggleCodeBlock({ language: value || '' })
                  .run()
              }
              autoFocus
            />
          </Popover.Dropdown>
        </Popover>
      </>
    );
  }, []);

  return (
    <>
      <ScrollArea h='100%' w='100%'>
        <Flex w='100%' justify='center'>
          <RichTextEditor
            editorRef={editorRef}
            domain={props.domain}
            value={savedDraft || wiki.draft || wiki.content}
            placeholder='Start typing here...'
            variant='inline'
            toolbarVariant='document'
            textStyle='document'
            focusRing={false}
            maxWidth={'62rem'}
            image
            youtube
            floatingMenu={floatingMenu}
            fileInputRef={fileInputRef}
            onAttachmentsChange={onAttachmentsChange}
            editorStyle={{
              padding: '6.0rem 6.0rem 8.0rem 6.0rem',
              minHeight: '50rem',
            }}
          />
        </Flex>
      </ScrollArea>

      <Transition mounted={loadingPopover} transition='slide-up'>
        {(styles) => (
          <Center
            sx={{
              position: 'absolute',
              bottom: '0.5rem',
              width: '100%',
            }}
          >
            <Group
              spacing='xs'
              style={styles}
              sx={(theme) => ({
                padding: '0.25rem 0.75rem',
                background: theme.other.colors.document,
                color: theme.other.colors.document_text,
                borderRadius: theme.radius.sm,
              })}
            >
              <Loader size='xs' />
              <Text size='sm' weight={500}>
                Loading image
              </Text>
            </Group>
          </Center>
        )}
      </Transition>

      <Group
        spacing='xs'
        sx={{
          position: 'absolute',
          top: '0.5rem',
          right: '1.0rem',
        }}
      >
        <Tooltip label='Leave Edit Mode'>
          <CloseButton
            size='lg'
            iconSize={24}
            sx={(theme) => ({
              background: `${theme.other.colors.page}D0`,
              '&:hover': {
                background: theme.other.colors.page_hover,
              },
            })}
            onClick={() => {
              if (!editorRef.current) return;

              // Check if it has changed
              const content = editorRef.current.getHTML();
              // console.log(origDraft)
              if (content === origDraft) {
                // Quit without prompt if no changes
                exitEditMode();
              } else {
                // Ask to confirm first
                openConfirmModal({
                  title: 'Discard Changes',
                  content: (
                    <Text>
                      Are you sure you want to discard your changes and exit?
                      Any changes that are not saved will be lost.
                    </Text>
                  ),
                  confirmLabel: 'Discard',
                  onConfirm: () => {
                    exitEditMode();
                  },
                });
              }
            }}
          />
        </Tooltip>

        <Button
          variant='default'
          leftIcon={<IconBookmark size={16} />}
          loading={loading}
          onClick={async () => {
            if (!editorRef.current || !wiki._exists) return;

            setLoading(true);
            try {
              const content = editorRef.current.getHTML();

              // Save draft
              if (content !== origDraft) {
                await wiki._mutators.updateWiki({
                  draft: content,
                });
              }

              // Switch out of edit mode
              exitEditMode();
            } finally {
              setLoading(false);
            }
          }}
        >
          Save & Exit
        </Button>

        <Button
          variant='gradient'
          leftIcon={<IconUpload size={16} />}
          loading={loading}
          onClick={async () => {
            if (!editorRef.current || !wiki._exists) return;

            setLoading(true);
            try {
              // Save content
              await wiki._mutators.updateWiki({
                content: editorRef.current.getHTML(),
              });

              // Switch out of edit mode
              exitEditMode();
            } finally {
              setLoading(false);
            }
          }}
        >
          Publish
        </Button>
      </Group>
    </>
  );
}

////////////////////////////////////////////////////////////
export type WikiViewProps = {
  channel: Channel;
  domain: DomainWrapper;
};

////////////////////////////////////////////////////////////
export default function WikiView(props: WikiViewProps) {
  // Wiki content
  const canEdit = hasPermission(
    props.domain,
    props.channel.id,
    'can_edit_document',
  );
  const wiki = useWiki(props.channel.id, canEdit);

  // Edit mode
  const [editing, setEditing] = useCachedState<boolean>(
    `${props.channel.id}/wiki.editing`,
    false,
  );

  return (
    <Box h='100%' w='100%' sx={{ position: 'relative' }}>
      {!editing && wiki._exists && (
        <DocView
          {...props}
          wiki={wiki}
          setEditing={setEditing}
          canEdit={canEdit}
        />
      )}
      {editing && wiki._exists && (
        <EditView {...props} wiki={wiki} setEditing={setEditing} />
      )}
    </Box>
  );
}
