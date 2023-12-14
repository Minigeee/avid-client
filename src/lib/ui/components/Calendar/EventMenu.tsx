import { PropsWithChildren, useMemo } from 'react';

import { Menu, Text } from '@mantine/core';
import { IconPencil, IconTrash } from '@tabler/icons-react';

import { openCreateCalendarEvent } from '@/lib/ui/modals';
import { useConfirmModal } from '@/lib/ui/modals/ConfirmModal';
import { ContextMenu } from '@/lib/ui/components/ContextMenu';

import { CalendarEvent } from '@/lib/types';
import { diff } from '@/lib/utility';

import { isNil, omitBy } from 'lodash';
import { useCalendarContext } from './hooks';

////////////////////////////////////////////////////////////
export type CalendarEventContext = {
  /** The event the menu should target */
  event: CalendarEvent;
};

////////////////////////////////////////////////////////////
export type CalendarEventMenuDropdownProps = CalendarEventContext;

////////////////////////////////////////////////////////////
export function CalendarEventMenuDropdown(
  props: CalendarEventMenuDropdownProps,
) {
  const { open: openConfirmModal } = useConfirmModal();
  const calendar = useCalendarContext();

  return (
    <>
      <Menu.Label>{props.event.title}</Menu.Label>

      <Menu.Item
        icon={<IconPencil size={16} />}
        onClick={() => {
          openCreateCalendarEvent({
            domain: calendar.domain,
            mode: 'edit',
            event: props.event,

            onSubmit: async (updated) => {
              // Get event diff
              let d = diff(event, updated);
              const remRepeat = d?.repeat === null;
              d = omitBy(d, isNil);

              // Add repeat null for remove
              if (remRepeat)
                // @ts-ignore
                d.repeat = null;

              if (Object.keys(d).length === 0) return;

              // Update callback
              calendar.onEditEvent.current?.(props.event.id, d);
            },
          });
        }}
      >
        Edit event
      </Menu.Item>

      <Menu.Divider />

      <Menu.Item
        color="red"
        icon={<IconTrash size={16} />}
        onClick={() => {
          openConfirmModal({
            title: 'Delete Event',
            content: (
              <Text>
                Are you sure you want to delete <b>{props.event.title}</b>?
              </Text>
            ),
            confirmLabel: 'Delete',
            onConfirm: () => {
              // Delete event
              calendar.onDeleteEvent.current?.(props.event.id);
            },
          });
        }}
      >
        Delete event
      </Menu.Item>
    </>
  );
}

////////////////////////////////////////////////////////////
export function CalendarEventContextMenu(props: PropsWithChildren) {
  return (
    <ContextMenu width="14rem">
      <ContextMenu.Dropdown dependencies={[]}>
        {(data) => <CalendarEventMenuDropdown {...data} />}
      </ContextMenu.Dropdown>

      {props.children}
    </ContextMenu>
  );
}
