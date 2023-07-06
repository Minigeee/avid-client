import { PropsWithChildren } from 'react';

import {
  Menu
} from '@mantine/core';
import { openConfirmModal } from '@mantine/modals';
import { IconArrowBackUp, IconCopy, IconLink, IconPencil, IconPhoto, IconPin, IconTrash } from '@tabler/icons-react';

import { ContextMenu } from '@/lib/ui/components/ContextMenu';
import { LoadedMessageViewContextState } from '../MessagesView';

import { MessagesWrapper, hasPermission } from '@/lib/hooks';
import { ExpandedMessage, Member } from '@/lib/types';

import moment from 'moment';
import { config as spacesConfig, getResourceUrl } from '@/lib/utility/spaces-util';


////////////////////////////////////////////////////////////
export type MessageMenuContext = {
  /** Message to show context menu for */
  msg: ExpandedMessage;
  /** Url of the image the user right clicked on */
  img?: string;
};

////////////////////////////////////////////////////////////
export type MessageMenuProps = PropsWithChildren & {
  /** Message view context */
  context: LoadedMessageViewContextState;
};

////////////////////////////////////////////////////////////
type MessageMenuDropdownProps = Omit<MessageMenuProps, 'children'> & MessageMenuContext;


////////////////////////////////////////////////////////////
export function MessageMenuDropdown({ context, msg, ...props }: MessageMenuDropdownProps) {
  return (
    <>
      <Menu.Label>{moment(msg.created_at).format('LLL')}</Menu.Label>

      {context.sender.id === msg.sender?.id && (
        <Menu.Item
          icon={<IconPencil size={16} />}
          onClick={() => context.state._set('editing', msg.id)}
        >
          Edit
        </Menu.Item>
      )}

      <Menu.Item
        icon={<IconArrowBackUp size={17} style={{ marginRight: -1, marginTop: -1 }} />}
        onClick={() => {
          context.state._set('replying_to', msg);
          context.refs.editor.current?.commands.focus();
        }}
      >
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
      {props.img && (
        <>
          <Menu.Divider />
          <Menu.Item
            icon={<IconPhoto size={16} />}
            onClick={async () => {
              const url = getResourceUrl(`${spacesConfig.img_path}/${props.img}`);
              const response = await fetch(url);
              const blob = await response.blob();
              navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            }}
          >
            Copy image
          </Menu.Item>
          <Menu.Item
            icon={<IconLink size={16} />}
            onClick={() => {
              if (!props.img) return;
              navigator.clipboard.writeText(getResourceUrl(`${spacesConfig.img_path}/${props.img}`));
            }}
          >
            Copy image address
          </Menu.Item>
        </>
      )}

      {(context.sender.id === msg.sender?.id || hasPermission(context.domain, context.channel_id, 'can_delete_messages')) && (
        <>
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
                  context.messages._mutators.deleteMessage(msg.id);
                }
              })
            }}
          >
            Delete
          </Menu.Item>
        </>
      )}
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
        props.context.messages,
        props.context.sender,
        props.context.state,
      ]}>
        {(context: MessageMenuContext) => (
          <MessageMenuDropdown
            context={props.context}
            {...context}
          />
        )}
      </ContextMenu.Dropdown>

      {props.children}
    </ContextMenu>
  );
}
