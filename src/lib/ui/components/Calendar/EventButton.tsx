import {
  HTMLProps,
  PropsWithChildren,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActionIcon,
  Box,
  Button,
  Checkbox,
  CloseButton,
  ColorInput,
  ColorSwatch,
  Divider,
  Flex,
  Group,
  MantineTheme,
  Menu,
  Popover,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton,
  UnstyledButtonProps,
} from '@mantine/core';
import { FloatingPosition } from '@mantine/core/lib/Floating';
import { useDebouncedValue } from '@mantine/hooks';
import {
  IconClock,
  IconDotsVertical,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react';

import { openCreateCalendarEvent } from '@/lib/ui/modals';
import ActionButton from '@/lib/ui/components/ActionButton';
import { useConfirmModal } from '@/lib/ui/modals/ConfirmModal';
import PRESET_COLORS from '@/lib/ui/components/PresetColors';

import config from '@/config';
import { CalendarEvent } from '@/lib/types';
import { useCalendarContext } from './hooks';
import { MomentCalendarEvent } from './types';
import {
  CalendarEventsWrapper,
  DomainWrapper,
  useCalendarEvent,
  useChatStyles,
} from '@/lib/hooks';
import { diff } from '@/lib/utility';

import moment, { Moment } from 'moment';
import { isNil, omitBy, pickBy } from 'lodash';

import { ContextMenu } from '../ContextMenu';

////////////////////////////////////////////////////////////
export type EventPopoverProps = PropsWithChildren &
  UnstyledButtonProps &
  Omit<HTMLProps<HTMLButtonElement>, 'ref'> & {
    /** The event to display */
    event: CalendarEvent | MomentCalendarEvent;

    /** Popover position */
    popoverPosition?: FloatingPosition;
  };

////////////////////////////////////////////////////////////
export default function EventButton({
  event: baseEvent,
  ...props
}: EventPopoverProps) {
  const { open: openConfirmModal } = useConfirmModal();
  const calendar = useCalendarContext();

  // Controls popover open state
  const [opened, setOpened] = useState<boolean>(false);
  const [delayedOpen] = useDebouncedValue(opened, 200);

  // Get full event
  const event = useCalendarEvent(
    opened || delayedOpen ? baseEvent.id : undefined,
    {
      ...baseEvent,
      start:
        typeof baseEvent.start === 'string'
          ? baseEvent.start
          : baseEvent.start.toISOString(),
      end:
        typeof baseEvent.end === 'string'
          ? baseEvent.end
          : baseEvent.end?.toISOString(),
    },
  );

  // Check if user can edit event
  const editable = true;

  // Description typography style
  const { classes } = useChatStyles();

  // Time text
  const timeText = useMemo(() => {
    const s = moment(baseEvent.start);
    const e = moment(baseEvent.end);

    if (!event.all_day)
      return `${s.format('dddd, LL | LT')} \u2013 ${e.format('LT')}`;

    return `${s.format('LL')} \u2013 ${e.format('LL')}`;
  }, [baseEvent.start, baseEvent.end]);

  return (
    <Popover
      opened={calendar.popupId === baseEvent.id && opened}
      onClose={() => setOpened(false)}
      closeOnClickOutside={false}
      position={props.popoverPosition || 'top-start'}
      withArrow
    >
      <Popover.Target>
        {/* @ts-ignore */}
        <ContextMenu.Trigger
          {...props}
          // @ts-ignore
          component={UnstyledButton}
          context={{ event }}
          onClick={(ev) => {
            // Call parent click func
            // @ts-ignore
            props.onClick?.(ev);

            // Toggle open state
            setOpened(!opened);
            if (!opened) calendar.setPopupId(baseEvent.id);
          }}
        >
          {props.children}
        </ContextMenu.Trigger>
      </Popover.Target>

      <Popover.Dropdown miw='24rem' maw='36rem' p='0.875rem 1.0rem'>
        <Flex gap={6} wrap='nowrap' align='center'>
          <ColorSwatch
            color={event.color || PRESET_COLORS.at(-1) || ''}
            size={20}
            mr={6}
            mt={1}
            sx={{ flexShrink: 0, cursor: 'pointer' }}
          />

          <Title order={3} sx={{ flexGrow: 1 }}>
            {event.title}
          </Title>

          {calendar.editable && (
            <>
              <ActionButton
                tooltip='Edit event'
                onClick={() => {
                  openCreateCalendarEvent({
                    domain: calendar.domain,
                    mode: 'edit',
                    event,

                    onSubmit: async (updated) => {
                      if (Object.keys(updated).length === 0) return;

                      // Update callback
                      calendar.onEditEvent.current?.(
                        {
                          ...updated,
                          start: updated.start ? moment(updated.start) : undefined,
                          end: updated.end ? moment(updated.end) : undefined,
                        },
                        {
                          ...baseEvent,
                          start: moment(baseEvent.start),
                          end: moment(baseEvent.end),
                        },
                      );
                    },
                  });
                }}
              >
                <IconPencil size={16} />
              </ActionButton>

              <ActionButton
                tooltip='Delete event'
                onClick={() => {
                  calendar.onDeleteEvent.current?.(baseEvent);
                }}
              >
                <IconTrash size={16} />
              </ActionButton>
            </>
          )}

          <CloseButton
            size='md'
            iconSize={18}
            sx={(theme) => ({
              '&:hover': { backgroundColor: theme.colors.dark[5] },
            })}
            onClick={() => setOpened(false)}
          />
        </Flex>

        <Text size='xs' color='dimmed' mt={4}>
          {timeText}
        </Text>

        {event.description && (
          <Text
            className={classes.typography}
            size='sm'
            mt={12}
            dangerouslySetInnerHTML={{
              __html: event.description || '<em>Click to add description<em>',
            }}
          />
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
