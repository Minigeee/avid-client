import {
  ForwardRefExoticComponent,
  PropsWithChildren,
  ReactElement,
  useMemo,
  useState,
} from 'react';

import {
  Box,
  CloseButton,
  Divider,
  Group,
  Indicator,
  LoadingOverlay,
  Popover,
  PopoverProps,
  ScrollArea,
  ScrollAreaAutosizeProps,
  Stack,
  Text,
  TextInput,
  TextInputProps,
  Title,
  UnstyledButton,
} from '@mantine/core';

import { Emoji } from './Emoji';
import MemberAvatar from './MemberAvatar';
import RoleBadges, { useRoleBadges } from './RoleBadges';

import { ExpandedMember, Role } from '@/lib/types';
import { DomainWrapper, hasPermission, useProfile } from '@/lib/hooks';
import { IconSearch } from '@tabler/icons-react';

////////////////////////////////////////////////////////////
export type PopoverSelectProps<T> = {
  children: (
    setOpened: (opened: boolean) => void,
    opened: boolean,
  ) => JSX.Element;
  /** Data to display */
  data: T[];
  /** The component that will be used to display an item (rendered inside a button) */
  itemComponent: ForwardRefExoticComponent<T>;

  /** Component that gets rendered after the search list in the popover */
  appendComponent?: JSX.Element;
  /** Props for the search bar */
  searchProps?: TextInputProps;
  /** Props for the popover */
  popoverProps?: PopoverProps;
  /** Props for scroll area */
  scrollAreaProps?: ScrollAreaAutosizeProps;
  /** SHould the popover be rendered in a portal */
  withinPortal?: boolean;
  /** Custom filter function */
  filter?: (search: string, value: T) => boolean;

  /** Function that gets called on item select */
  onSelect?: (item: T) => boolean | undefined | void | Promise<boolean | undefined | void>;
};

////////////////////////////////////////////////////////////
export function PopoverSelectDropdown<T>(
  props: Omit<PopoverSelectProps<T>, 'children'> & { setOpened?: (value: boolean) => void },
) {
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const filtered = useMemo(() => {
    if (search.length === 0) return props.data;

    // FIlter function
    const lc = search.toLocaleLowerCase();
    const filter = props.filter ? ((x: T) => props.filter?.(lc, x)) : ((x: any) => (x.label.toLocaleLowerCase().indexOf(lc) >= 0));

    return props.data.filter(filter);
  }, [search, props.data]);

  return (
    <>
      <LoadingOverlay visible={loading} />

      <TextInput
        p='0.5rem'
        {...props.searchProps}
        icon={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        rightSection={
          search.length > 0 ? (
            <CloseButton onClick={() => setSearch('')} />
          ) : undefined
        }
        autoFocus
      />

      <Divider sx={(theme) => ({ borderColor: theme.colors.dark[5] })} />

      <ScrollArea.Autosize mah='30rem' p='0.5rem' {...props.scrollAreaProps}>
        <Stack spacing={0}>
          {filtered.map((item: any, i) => (
            <UnstyledButton
              key={i}
              p='0.35rem 0.6rem'
              maw='20rem'
              sx={(theme) => ({
                borderRadius: theme.radius.sm,
                cursor: 'pointer',

                '&:hover': {
                  backgroundColor: theme.colors.dark[5],
                },
              })}
              onClick={async () => {
                try {
                  setLoading(true);

                  // On select
                  const success = await props.onSelect?.(item);

                  // Close
                  if (!props.onSelect || success !== false)
                    props.setOpened?.(false);
                } finally {
                  setLoading(false);
                }
              }}
            >
              <props.itemComponent {...item} />
            </UnstyledButton>
          ))}
        </Stack>
      </ScrollArea.Autosize>

      {props.appendComponent}
    </>
  );
}


////////////////////////////////////////////////////////////
export default function PopoverSelect<T>(props: PopoverSelectProps<T>) {
  const [opened, setOpened] = useState<boolean>(false);

  return (
    <Popover
      {...props.popoverProps}
      opened={opened}
      onClose={() => setOpened(false)}
      withinPortal={props.withinPortal}
    >
      <Popover.Target>{props.children(setOpened, opened)}</Popover.Target>

      <Popover.Dropdown p={0} miw='16rem'>
        <PopoverSelectDropdown {...props} setOpened={setOpened} />
      </Popover.Dropdown>
    </Popover>
  );
}
