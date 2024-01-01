import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';

import {
  CloseButton,
  Group,
  MultiSelect,
  MultiSelectProps,
  MultiSelectValueProps,
  Select,
  SelectProps,
  Text,
  rem,
} from '@mantine/core';

import MemberAvatar from './MemberAvatar';

import config from '@/config';
import { ExpandedMember } from '@/lib/types';
import { listMembers, useSession } from '@/lib/hooks';

////////////////////////////////////////////////////////////
function useMemberInput(
  domain_id: string,
  exclude_role?: string,
  exclude?: string[],
) {
  const session = useSession();

  // Members data that apperas in dropdown
  const [members, setMembers] = useState<ExpandedMember[]>([]);

  // Track query to make bold string
  const [query, setQuery] = useState<string>('');
  // Used to track if member query has retrieved all members
  const [hasMoreResults, setHasMoreResults] = useState<Record<string, boolean>>(
    {},
  );

  // Dropdown data
  const data = useMemo(
    () => members.map((x) => ({ value: x.id, label: x.alias, member: x })),
    [members],
  );

  // Called when search query changes
  const onSearchChange = useCallback(
    async (query: string) => {
      query = query.toLocaleLowerCase();
      setQuery(query);

      // Filter members by name
      let filtered = members.filter((x) =>
        x.alias.toLocaleLowerCase().startsWith(query),
      );

      // Check if more members need to be requested
      if (
        filtered.length <= config.app.member.new_query_threshold &&
        query.length &&
        hasMoreResults[query.slice(0, -1)]
      ) {
        // Request new search query
        const { data: newMembers } = await listMembers(
          domain_id,
          { search: query, exclude_role_id: exclude_role },
          session,
        );

        // Merge members lists
        const memberMap: Record<string, ExpandedMember> = {};
        for (const member of newMembers) memberMap[member.id] = member;

        // Add old members to new list
        for (const member of members) {
          if (!memberMap[member.id]) newMembers.push(member);
        }

        // Set of members to exclude
        const excludeSet = new Set<string>(exclude || []);

        // Sort members array
        newMembers.sort((a, b) => a.alias.localeCompare(b.alias));
        setMembers(newMembers.filter((x) => !excludeSet.has(x.id)));

        // Refilter and evaluate
        filtered = members.filter((x) =>
          x.alias.toLocaleLowerCase().startsWith(query.toLocaleLowerCase()),
        );
        setHasMoreResults({
          ...hasMoreResults,
          [query]: newMembers.length >= config.app.member.query_limit,
        });
      } else {
        // Update flag that indicates if there are potentially more results to see
        setHasMoreResults({
          ...hasMoreResults,
          [query]: hasMoreResults[query.slice(0, -1)],
        });
      }
    },
    [members, hasMoreResults],
  );

  // Used to get initial members
  useEffect(() => {
    const excludeSet = new Set<string>(exclude || []);
    listMembers(domain_id, { exclude_role_id: exclude_role }, session).then(
      (results) =>
        setMembers(results.data.filter((x) => !excludeSet.has(x.id))),
    );
  }, []);

  // Dropdown item component
  const SelectItem = useMemo(() => {
    const component = forwardRef<HTMLDivElement, ItemProps>(
      ({ label, member, ...others }: ItemProps, ref) => {
        label = label.replace(/<[^>]*>/g, '');
        const idx = label
          .toLocaleLowerCase()
          .indexOf(query.toLocaleLowerCase());
        if (idx >= 0)
          label = `${label.slice(0, idx)}<b>${label.slice(
            idx,
            idx + query.length,
          )}</b>${label.slice(idx + query.length)}`;

        return (
          <div ref={ref} {...others}>
            <Group noWrap>
              <MemberAvatar size={32} member={member} />
              <Text dangerouslySetInnerHTML={{ __html: label }} />
            </Group>
          </div>
        );
      },
    );
    component.displayName = 'MemberInput.SelectItem';

    return component;
  }, [query]);

  return {
    members,
    data,
    query,
    onSearchChange,
    SelectItem,
  };
}

////////////////////////////////////////////////////////////
type ItemProps = {
  label: string;
  member: ExpandedMember;
};

////////////////////////////////////////////////////////////
type MemberInputProps = Omit<SelectProps, 'data' | 'value' | 'onChange'> & {
  /** Domain id used to search members within domain */
  domain_id: string;

  value?: ExpandedMember | null;
  onChange?: (value: ExpandedMember | null) => any;
};

////////////////////////////////////////////////////////////
export default function MemberInput({ domain_id, ...props }: MemberInputProps) {
  const { members, data, onSearchChange, SelectItem } =
    useMemberInput(domain_id);

  const [value, setValue] = useState<ExpandedMember | null>(null);

  return (
    <Select
      {...props}
      value={props.value?.id || value?.id || null}
      onChange={(id) => {
        const member = id ? members.find((x) => x.id === id) || null : null;

        if (props.onChange) props.onChange(member);
        else if (!props.value) setValue(member);
      }}
      icon={<MemberAvatar member={props.value || value} size={28} />}
      iconWidth={40}
      itemComponent={SelectItem}
      onSearchChange={onSearchChange}
      searchable
      data={data}
    />
  );
}

////////////////////////////////////////////////////////////
function MultiMemberInputValue({
  member,
  label,
  onRemove,
  classNames,
  ...others
}: MultiSelectValueProps & { member: ExpandedMember }) {
  return (
    <div {...others}>
      <Group
        spacing={4}
        sx={(theme) => ({
          cursor: 'default',
          padding: `${rem(0)} ${rem(3)} ${rem(0.5)} ${rem(3)}`,
          background: theme.other.colors.panel,
          borderRadius: 20,
        })}
      >
        <MemberAvatar size={20} member={member} />
        <Text size='xs' ml={2}>
          {label}
        </Text>

        <CloseButton
          onMouseDown={onRemove}
          variant='transparent'
          size={22}
          iconSize={14}
          tabIndex={-1}
          mt={1}
        />
      </Group>
    </div>
  );
}

////////////////////////////////////////////////////////////
type MultiMemberInputProps = Omit<
  MultiSelectProps,
  'data' | 'value' | 'onChange'
> & {
  /** Domain id used to search members within domain */
  domain_id: string;

  /** A role id to exclude from dropdown list */
  exclude_role?: string;
  /** A list of members to exclude from the dropdown list */
  exclude?: string[];
  value?: ExpandedMember[] | null;
  onChange?: (value: ExpandedMember[]) => any;
};

////////////////////////////////////////////////////////////
export function MultiMemberInput({
  domain_id,
  ...props
}: MultiMemberInputProps) {
  const { members, data, onSearchChange, SelectItem } = useMemberInput(
    domain_id,
    props.exclude_role,
    props.exclude,
  );

  const [values, setValues] = useState<ExpandedMember[]>([]);

  // List of value ids
  const valueIds = useMemo(
    () => (props.value || values).map((x) => x.id),
    [props.value, values],
  );

  return (
    <MultiSelect
      {...props}
      value={valueIds}
      onChange={(ids) => {
        const memberMap: Record<string, ExpandedMember> = {};
        for (const member of members) memberMap[member.id] = member;

        // Chosen members
        const chosen = ids.map((id) => memberMap[id]);

        if (props.onChange) props.onChange(chosen);
        else if (!props.value) setValues(chosen);
      }}
      valueComponent={MultiMemberInputValue}
      itemComponent={SelectItem}
      onSearchChange={onSearchChange}
      searchable
      data={data}
    />
  );
}
