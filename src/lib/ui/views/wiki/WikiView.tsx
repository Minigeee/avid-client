import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Text,
  Tooltip,
  Transition,
  useMantineTheme,
} from '@mantine/core';
import { useInterval } from '@mantine/hooks';
import { IconBookmark, IconCode, IconCopy, IconEye, IconPencil, IconPhotoPlus, IconUpload } from '@tabler/icons-react';

import RichTextEditor from '@/lib/ui/components/rte/RichTextEditor';
import { useConfirmModal } from '../../modals/ConfirmModal';

import { Attachment, Channel, FileAttachment } from '@/lib/types';
import {
  DomainWrapper,
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
import { config as spacesConfig, getResourceUrl, getImageUrl, getResourceKey } from '@/lib/utility/spaces-util';
import ActionButton from '../../components/ActionButton';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { startCase } from 'lodash';

/** Supported code languages */
const SUPPORTED_LANGUAGES = [
  { value: '', label: 'None' },
  ...SyntaxHighlighter.supportedLanguages.map((lang) => ({
    value: lang,
    label: startCase(lang),
  })),
];

////////////////////////////////////////////////////////////
export type WikiViewProps = {
  channel: Channel;
  domain: DomainWrapper;
};

////////////////////////////////////////////////////////////
export default function WikiView(props: WikiViewProps) {
  const session = useSession();
  const { open: openConfirmModal } = useConfirmModal();
  
  // Refs
  const editorRef = useRef<Editor>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Styles
  const { classes } = useDocumentStyles();

  // Wiki content
  const canEdit = hasPermission(
    props.domain,
    props.channel.id,
    'can_edit_document',
  );
  const wiki = useWiki(props.channel.id, canEdit);

  // Loading
  const [loading, setLoading] = useState<boolean>(false);
  // Edit mode
  const [editing, setEditing] = useCachedState<boolean>(
    `${props.channel.id}/wiki.editing`,
    false,
  );
  // In view draft mode?
  const [viewDraft, setViewDraft] = useState<boolean>(false);
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

  // Convenience function to leave edit mode
  const exitEditMode = () => {
    setEditing(false);
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
    if (!editing) return;

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
  }, [editing]);

  // Save original draft
  useEffect(() => {
    if (!editorRef.current) return;
    setOrigDraft(editorRef.current.getHTML());
  }, [lagged]);

  // Parse html string
  const docContents = useMemo(() => {
    if (!wiki._exists) return null;
    if (editing) return null;

    // IMG DIMS
    const IMG_WIDTH = 800;

    return parseHtml(!viewDraft ? wiki.content : wiki.draft || '', {
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
        }
        else if (node.name === 'pre') {
          const child = node.firstChild;
          if (!(child instanceof Element) || child.name !== 'code') return;
          if (!(child.firstChild instanceof DomText) || !child.firstChild.data) return;

          const lang = child.attribs.class?.split('language-')[1];
          const code = child.firstChild.data;

          return (
            <Box sx={{ position: 'relative' }}>
              <SyntaxHighlighter language={lang} style={oneLight}>
                {child.firstChild.data}
              </SyntaxHighlighter>

              <ActionButton
                tooltip='Copy code'
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
  }, [wiki.content, wiki.draft, wiki.attachments, viewDraft, editing]);

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
    <Box h='100%' w='100%' sx={{ position: 'relative' }}>
      <ScrollArea h='100%' w='100%'>
        <Flex w='100%' justify='center'>
          {!editing && wiki._exists && (
            <Box
              className={classes.typography}
              sx={(theme) => ({
                position: 'relative',
                padding: '6.0rem 0.0rem 8.0rem 0.0rem',
                width: '50rem',
                maxWidth: '100%',
                minHeight: 'calc(100vh - 6.0rem)',
              })}
            >
              {docContents}
            </Box>
          )}

          {editing && (
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
          )}
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

      {canEdit && (
        <Group
          spacing='xs'
          sx={{
            position: 'absolute',
            top: '0.5rem',
            right: '1.0rem',
          }}
        >
          {!editing && (
            <>
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
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            </>
          )}

          {editing && (
            <>
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
                            Are you sure you want to discard your changes and
                            exit? Any changes that are not saved will be lost.
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
            </>
          )}
        </Group>
      )}
    </Box>
  );
}
