import { PropsWithChildren } from 'react';

import {
  Menu
} from '@mantine/core';
import { IconArrowBackUp, IconCopy, IconPencil, IconPin, IconTrash } from '@tabler/icons-react';

import { ContextMenu } from '@/lib/ui/components/ContextMenu';

import { MessagesWrapper } from '@/lib/hooks';
import { ExpandedMessage, Member } from '@/lib/types';

import moment from 'moment';
import { openConfirmModal } from '@mantine/modals';


////////////////////////////////////////////////////////////
export type MessageMenuContext = {
  /** Message to show context menu for */
  msg: ExpandedMessage;
};

////////////////////////////////////////////////////////////
export type MessageMenuProps = PropsWithChildren & {
  /** Messages wrapper */
  messages: MessagesWrapper;
  /** User that is viewing message, used to determine if have perms to edit */
  viewer?: Member;
  /** Function to set editing state for message */
  setEditing?: (message_id: string) => void;
};

////////////////////////////////////////////////////////////
type MessageMenuDropdownProps = Omit<MessageMenuProps, 'children'> & MessageMenuContext;


////////////////////////////////////////////////////////////
export function MessageMenuDropdown({ msg, ...props }: MessageMenuDropdownProps) {
  return (
    <>
      <Menu.Label>{moment(msg.created_at).format('LLL')}</Menu.Label>

      {props.viewer && props.viewer.id === msg.sender?.id && props.setEditing && (
        <Menu.Item
          icon={<IconPencil size={16} />}
          onClick={() => props.setEditing?.(msg.id)}
        >
          Edit
        </Menu.Item>
      )}

      <Menu.Item icon={<IconArrowBackUp size={17} style={{ marginRight: -1, marginTop: -1 }} />}>
        Reply
      </Menu.Item>
      <Menu.Item icon={<IconPin size={16} />} disabled>
        Pin
      </Menu.Item>
      <Menu.Item
        icon={<IconCopy size={16} />}
        onClick={() => {
          const blobInput = new Blob([msg.message], { type: 'text/html' });
          const clipboardItemInput = new ClipboardItem({ 'text/html': blobInput });
          navigator.clipboard.write([clipboardItemInput]);
        }}
      >
        Copy message
      </Menu.Item>

      <Menu.Divider />
      
      <Menu.Item
        icon={<IconTrash size={16} />}
        color='red'
        onClick={() => {
          openConfirmModal({
            title: 'Delete Message',
            labels: { cancel: 'Cancel', confirm: 'Delete' },
            children: (
              <>Are you sure you want to delete this message?</>
            ),
            groupProps: {
              spacing: 'xs',
              sx: { marginTop: '0.5rem' },
            },
            confirmProps: {
              color: 'red',
            },
            onConfirm: () => {
              // Delete message
              props.messages._mutators.deleteMessage(msg.id);
            }
          })
        }}
      >
        Delete
      </Menu.Item>
    </>
  )
}


////////////////////////////////////////////////////////////
export function MessageContextMenu(props: MessageMenuProps) {
  return (
    <ContextMenu
      width='12rem'
    >
      <ContextMenu.Dropdown dependencies={[
        props.messages,
        props.viewer,
        props.setEditing,
      ]}>
        {(context: MessageMenuContext) => (
          <MessageMenuDropdown
            messages={props.messages}
            viewer={props.viewer}
            setEditing={props.setEditing}

            msg={context.msg}
          />
        )}
      </ContextMenu.Dropdown>

      {props.children}
    </ContextMenu>
  );
}
