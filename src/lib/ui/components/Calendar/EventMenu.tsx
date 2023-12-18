import { PropsWithChildren, useMemo } from 'react';

import { Menu, Text } from '@mantine/core';
import { IconPencil, IconTrash } from '@tabler/icons-react';

import { openCreateCalendarEvent } from '@/lib/ui/modals';
import { useConfirmModal } from '@/lib/ui/modals/ConfirmModal';
import { ContextMenu } from '@/lib/ui/components/ContextMenu';

import { CalendarEvent } from '@/lib/types';
import { diff } from '@/lib/utility';

import { isNil, omitBy, pickBy } from 'lodash';
import { useCalendarContext } from './hooks';
import moment from 'moment';

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
              if (Object.keys(updated).length === 0) return;

              // Update callback
              calendar.onEditEvent.current?.(
                {
                  ...updated,
                  start: moment(updated.start),
                  end: moment(updated.end),
                },
                {
                  ...props.event,
                  start: moment(props.event.start),
                  end: moment(props.event.end),
                },
              );
            },
          });
        }}
      >
        Edit event
      </Menu.Item>

      <Menu.Divider />

      <Menu.Item
        color='red'
        icon={<IconTrash size={16} />}
        onClick={() => {
          calendar.onDeleteEvent.current?.(props.event);
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
    <ContextMenu width='14rem'>
      <ContextMenu.Dropdown dependencies={[]}>
        {(data) => <CalendarEventMenuDropdown {...data} />}
      </ContextMenu.Dropdown>

      {props.children}
    </ContextMenu>
  );
}
