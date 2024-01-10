import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ActionIcon, Box, Button, CloseButton, Flex, Group, ScrollArea, Text, Tooltip, useMantineTheme } from '@mantine/core';
import { useInterval } from '@mantine/hooks';
import { IconBookmark, IconPencil, IconUpload } from '@tabler/icons-react';

import RichTextEditor from '@/lib/ui/components/rte/RichTextEditor';
import { useConfirmModal } from '../../modals/ConfirmModal';

import { Channel } from '@/lib/types';
import {
  DomainWrapper,
  hasPermission,
  useApp,
  useCachedState,
  useCalendarEvents,
  useDocumentStyles,
  useWiki,
} from '@/lib/hooks';
import { socket } from '@/lib/utility/realtime';
import { events } from '@/lib/utility/events';

import moment, { Moment } from 'moment';
import { Editor } from '@tiptap/react';

////////////////////////////////////////////////////////////
export type WikiViewProps = {
  channel: Channel;
  domain: DomainWrapper;
};

////////////////////////////////////////////////////////////
export default function WikiView(props: WikiViewProps) {
  const editorRef = useRef<Editor>();

  // Styles
  const { classes } = useDocumentStyles();

  // Wiki content
  const canEdit = hasPermission(props.domain, props.channel.id, 'can_edit_document');
  const wiki = useWiki(props.channel.id, canEdit);

  // Loading
  const [loading, setLoading] = useState<boolean>(false);
  // Edit mode
  const [editing, setEditing] = useCachedState<boolean>(`${props.channel.id}/wiki.editing`, false);
  // Saved draft
  const [savedDraft, setSavedDraft] = useCachedState<string>(`${props.channel.id}/wiki.saved_draft`, '');

  // Saving loop
  const saveInterval = useInterval(() => {
    if (!editorRef.current) return;
    const content = editorRef.current.getHTML();

    // Save draft
    if (wiki._exists && content !== wiki.draft) {
      wiki._mutators.updateWiki({
        draft: content,
      });
    }
  }, 2 * 60 * 1000);

  // Detect when channel changes to save
  useEffect(() => {
    if (!editing) return;

    // Event listener
    const id = events.on('channel-change', (channel_id) => {
      if (!editorRef.current) return;
      const content = editorRef.current.getHTML();

      // Save draft
      if (wiki._exists && content !== wiki.draft) {
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

  return (
    <ScrollArea h='100%' w='100%'>
      <Flex w='100%' justify='center' sx={{ position: 'relative' }}>
        {!editing && wiki._exists && (
          <Box
            className={classes.typography}
            sx={{
              padding: '5.0rem 6.0rem 8.0rem 6.0rem',
              width: '56rem',
              maxWidth: '100%',
              minHeight: '50rem',
            }}
            dangerouslySetInnerHTML={{ __html: wiki.content }}
          />
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
            maxWidth={'56rem'}
            editorStyle={{
              padding: '6.0rem 6.0rem 8.0rem 6.0rem',
              minHeight: '50rem',
            }}
          />
        )}

        {canEdit && (
          <Group
            spacing='xs'
            sx={{
              position: 'absolute',
              top: '0.5rem',
              right: '0.75rem',
            }}
          >
            {!editing && (
              <Button
                variant='default'
                leftIcon={<IconPencil size={16} />}
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            )}

            {editing && (
              <>
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
                      if (content !== wiki.draft) {
                        await wiki._mutators.updateWiki({
                          draft: content,
                        });
                      }

                      // Switch out of edit mode
                      setEditing(false);
                      setSavedDraft('');
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
                      setEditing(false);
                      setSavedDraft('');
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
      </Flex>
    </ScrollArea>
  );
}
