import { PropsWithChildren, useMemo, useRef } from 'react';

import { Menu, Text } from '@mantine/core';
import {
  IconArrowBackUp,
  IconCopy,
  IconLink,
  IconMoodMinus,
  IconMoodPlus,
  IconMoodX,
  IconPencil,
  IconPhoto,
  IconPin,
  IconPinnedOff,
  IconTrash,
} from '@tabler/icons-react';

import { ContextMenu } from '@/lib/ui/components/ContextMenu';
import { LoadedMessageViewContextState } from '../MessagesView';

import { MessagesWrapper, hasPermission } from '@/lib/hooks';
import { ExpandedMessage, Member } from '@/lib/types';

import moment from 'moment';
import {
  config as spacesConfig,
  getResourceUrl,
} from '@/lib/utility/spaces-util';
import { EmojiPicker } from '@/lib/ui/components/Emoji';
import { useConfirmModal } from '@/lib/ui/modals/ConfirmModal';

////////////////////////////////////////////////////////////
export type MessageMenuContext = {
  /** Message to show context menu for */
  msg: ExpandedMessage;
  /** Url of the image the user right clicked on */
  img?: string;
  /** Custom edit function */
  onEdit?: (message_id: string) => void;
};

////////////////////////////////////////////////////////////
export type MessageMenuProps = PropsWithChildren & {
  /** Message view context */
  context: LoadedMessageViewContextState;
};

////////////////////////////////////////////////////////////
type MessageMenuDropdownProps = Omit<MessageMenuProps, 'children'> &
  MessageMenuContext;

////////////////////////////////////////////////////////////
export function MessageMenuDropdown({
  context,
  msg,
  ...props
}: MessageMenuDropdownProps) {
  const { open: openConfirmModal } = useConfirmModal();

  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Check if message has any self reactions
  const hasSelfReactions = useMemo(
    () => msg.reactions?.find((r) => r.self) !== undefined,
    [msg.reactions],
  );

  // Create delete section
  const deleteSection: JSX.Element[] = [];

  // Delete own reactions
  if (hasSelfReactions) {
    deleteSection.push(
      <Menu.Item
        icon={<IconMoodMinus size={16} />}
        color="red"
        onClick={() => {
          // Delete own reactions
          context.messages._mutators.removeReactions(msg.id, { self: true });
        }}
      >
        Remove my reactions
      </Menu.Item>,
    );
  }

  // Delete all reactions
  if (
    msg.reactions?.length &&
    hasPermission(context.domain, context.channel_id, 'can_manage_messages')
  ) {
    deleteSection.push(
      <Menu.Item
        icon={<IconMoodX size={16} />}
        color="red"
        onClick={() => {
          openConfirmModal({
            title: 'Remove All Reactions',
            content: (
              <Text>
                Are you sure you want to remove all reactions from this message?
              </Text>
            ),
            confirmLabel: 'Remove',
            onConfirm: async () => {
              // Delete all reactions
              context.messages._mutators.removeReactions(msg.id);
            },
          });
        }}
      >
        Remove all reactions
      </Menu.Item>,
    );
  }

  // Delete message
  if (
    context.sender.id === msg.sender?.id ||
    hasPermission(context.domain, context.channel_id, 'can_manage_messages')
  ) {
    deleteSection.push(
      <Menu.Item
        icon={<IconTrash size={16} />}
        color="red"
        onClick={() => {
          openConfirmModal({
            title: 'Delete Message',
            confirmLabel: 'Delete',
            content: <Text>Are you sure you want to delete this message?</Text>,
            onConfirm: () => {
              // Delete message
              context.messages._mutators.deleteMessage(msg.id);
            },
          });
        }}
      >
        Delete
      </Menu.Item>,
    );
  }

  return (
    <>
      <Menu.Label>{moment(msg.created_at).format('LLL')}</Menu.Label>

      {context.sender.id === msg.sender?.id && (
        <Menu.Item
          icon={<IconPencil size={16} />}
          onClick={() =>
            props.onEdit
              ? props.onEdit(msg.id)
              : context.state._set('editing', msg.id)
          }
        >
          Edit
        </Menu.Item>
      )}

      <Menu.Item
        icon={
          <IconArrowBackUp
            size={17}
            style={{ marginRight: -1, marginTop: -1 }}
          />
        }
        onClick={() => {
          context.state._set('replying_to', msg);
          context.refs.editor.current?.commands.focus();
        }}
      >
        Reply
      </Menu.Item>

      {hasPermission(
        context.domain,
        context.channel_id,
        'can_send_reactions',
      ) && (
        <ContextMenu.Submenu
          id="add-reaction"
          label="Add reaction"
          icon={<IconMoodPlus size={16} />}
          position="right"
          noScroll
        >
          <EmojiPicker
            emojiSize={32}
            onSelect={(emoji) => {
              // Check if this emoji has already been used
              const reaction = msg.reactions?.find(
                (x) =>
                  x.self &&
                  (x.emoji === emoji.id || x.emoji === emoji.skins[0].native),
              );

              // Add reaction
              if (!reaction && emoji.skins.length > 0)
                context.messages._mutators.addReaction(msg.id, emoji.id);

              // Close menu
              closeBtnRef.current?.click();
            }}
          />
          <Menu.Item ref={closeBtnRef} sx={{ display: 'none' }} />
        </ContextMenu.Submenu>
      )}

      {hasPermission(
        context.domain,
        context.channel_id,
        'can_manage_messages',
      ) && (
        <Menu.Item
          icon={
            msg.pinned ? <IconPinnedOff size={16} /> : <IconPin size={16} />
          }
          onClick={() => {
            if (!msg.pinned) context.messages._mutators.pinMessage(msg.id);
            else {
              openConfirmModal({
                title: 'Unpin Message',
                content: (
                  <Text>Are you sure you want to unpin this message?</Text>
                ),
                confirmLabel: 'Unpin',
                onConfirm: () => {
                  context.messages._mutators.unpinMessage(msg.id);
                },
              });
            }
          }}
        >
          {msg.pinned ? 'Unpin' : 'Pin'}
        </Menu.Item>
      )}

      <Menu.Item
        icon={<IconCopy size={16} />}
        onClick={() => {
          const blobInput = new Blob([msg.message], { type: 'text/html' });
          const clipboardItemInput = new ClipboardItem({
            'text/html': blobInput,
          });
          navigator.clipboard.write([clipboardItemInput]);
        }}
      >
        Copy message
      </Menu.Item>
      {props.img && (
        <>
          <Menu.Divider />
          <Menu.Item
            icon={<IconPhoto size={16} />}
            onClick={async () => {
              const url = getResourceUrl(
                `${spacesConfig.img_path}/${props.img}`,
              );
              const response = await fetch(url);
              const blob = await response.blob();
              navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob }),
              ]);
            }}
          >
            Copy image
          </Menu.Item>
          <Menu.Item
            icon={<IconLink size={16} />}
            onClick={() => {
              if (!props.img) return;
              navigator.clipboard.writeText(
                getResourceUrl(`${spacesConfig.img_path}/${props.img}`),
              );
            }}
          >
            Copy image address
          </Menu.Item>
        </>
      )}

      {deleteSection.length > 0 && (
        <>
          <Menu.Divider />
          {deleteSection}
        </>
      )}
    </>
  );
}

////////////////////////////////////////////////////////////
export function MessageContextMenu(props: MessageMenuProps) {
  return (
    <ContextMenu width="14rem">
      <ContextMenu.Dropdown
        dependencies={[
          props.context.messages,
          props.context.sender,
          props.context.state,
        ]}
      >
        {(context: MessageMenuContext) => (
          <MessageMenuDropdown context={props.context} {...context} />
        )}
      </ContextMenu.Dropdown>

      {props.children}
    </ContextMenu>
  );
}
