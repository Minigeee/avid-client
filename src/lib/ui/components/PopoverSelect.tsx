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
  Stack,
  Text,
  TextInput,
  TextInputProps,
  Title,
} from '@mantine/core';

import { Emoji } from './Emoji';
import MemberAvatar from './MemberAvatar';
import RoleBadges, { useRoleBadges } from './RoleBadges';

import { ExpandedMember, Role } from '@/lib/types';
import { DomainWrapper, hasPermission, useProfile } from '@/lib/hooks';
import { IconSearch } from '@tabler/icons-react';

////////////////////////////////////////////////////////////
export type PopoverSelect<T> = {
  children: (
    setOpened: (opened: boolean) => void,
    opened: boolean,
  ) => JSX.Element;
  data: T[];
  itemComponent: ForwardRefExoticComponent<Role>;
  searchProps?: TextInputProps;
  popoverProps?: PopoverProps;
  withinPortal?: boolean;
  labelField?: string;

  onSelect?: (item: T) => Promise<boolean | undefined | void>;
};

////////////////////////////////////////////////////////////
export default function PopoverSelect<T>(props: PopoverSelect<T>) {
  const labelField = props.labelField || 'label';

  const [opened, setOpened] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const filtered = useMemo(() => {
    if (search.length === 0) return props.data;

    const lc = search.toLocaleLowerCase();
    return props.data.filter(
      (x: any) => x[labelField].toLocaleLowerCase().indexOf(lc) >= 0,
    );
  }, [search, props.data]);

  return (
    <Popover
      {...props.popoverProps}
      opened={opened}
      onClose={() => setOpened(false)}
      withinPortal={props.withinPortal}
    >
      <Popover.Target>{props.children(setOpened, opened)}</Popover.Target>

      <Popover.Dropdown p={0} miw="16rem">
        <LoadingOverlay visible={loading} />

        <TextInput
          p="0.5rem"
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

        <ScrollArea.Autosize mah="30rem" p="0.5rem">
          <Stack spacing={0}>
            {filtered.map((item: any, i) => (
              <Box
                key={i}
                p="0.35rem 0.6rem"
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
                    if (!props.onSelect || success !== false) setOpened(false);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <props.itemComponent {...item} />
              </Box>
            ))}
          </Stack>
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}
