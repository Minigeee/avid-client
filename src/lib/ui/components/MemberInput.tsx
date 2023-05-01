import { forwardRef, useEffect, useState } from 'react';

import {
  Group,
  Select,
  SelectProps,
  Text,
} from '@mantine/core';

import MemberAvatar from './MemberAvatar';

import config from '@/config';
import { Member } from '@/lib/types';
import { listMembers } from '@/lib/db';
import { useSession } from '@/lib/hooks';


////////////////////////////////////////////////////////////
type ItemProps = {
  label: string;
  member: Member;
};

////////////////////////////////////////////////////////////
type MemberInputProps = Omit<SelectProps, 'data' | 'value' | 'onChange'> & {
  /** Domain id used to search members within domain */
  domain_id?: string;

  value?: Member | null;
  onChange?: (value: Member | null) => any;
};

////////////////////////////////////////////////////////////
export default function MemberInput({ domain_id, ...props }: MemberInputProps) {
  const session = useSession();

  const [value, setValue] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  useEffect(() => {
    // Used to get initial members
    if (domain_id)
      listMembers(domain_id, '', session).then(setMembers);
  }, [domain_id]);

  // Track query to make bold string
  const [query, setQuery] = useState<string>('');
  // Used to track if member query has retrieved all members
  const [hasMoreResults, setHasMoreResults] = useState<Record<string, boolean>>({});

  ////////////////////////////////////////////////////////////
  const SelectItem = forwardRef<HTMLDivElement, ItemProps>(
    ({ label, member, ...others }: ItemProps, ref) => {
      const idx = label.toLowerCase().indexOf(query);
      if (idx >= 0)
        label = `${label.slice(0, idx)}<b>${label.slice(idx, idx + query.length)}</b>${label.slice(idx + query.length)}`;

      return (
        <div ref={ref} {...others}>
          <Group noWrap>
            <MemberAvatar size={32} member={member} />
            <Text dangerouslySetInnerHTML={{ __html: label }} />
          </Group>
        </div>
      );
    }
  );


  return (
    <Select
      {...props}
      
      value={props.value?.id || value?.id || null}
      onChange={(id) => {
        const member = id ? members.find(x => x.id === id) || null : null;

        if (props.onChange)
          props.onChange(member);
        else if (!props.value)
          setValue(member);
      }}

      icon={<MemberAvatar member={props.value || value} size={28} />}
      iconWidth={40}
      itemComponent={SelectItem}
      onSearchChange={async (query) => {
        if (!domain_id) return;
        query = query.toLowerCase();
        setQuery(query);

        // Filter members by name
        let filtered = members.filter(x => x.alias.toLowerCase().startsWith(query));

        // Check if more members need to be requested
        if (filtered.length <= config.app.member.new_query_threshold && (query.length && hasMoreResults[query.slice(0, -1)])) {
          // Request new search query
          const newMembers = await listMembers(domain_id, query, session);

          // Merge members lists
          const memberMap: Record<string, Member> = {};
          for (const member of newMembers)
            memberMap[member.id] = member;

          // Add old members to new list
          for (const member of members) {
            if (!memberMap[member.id])
              newMembers.push(member);
          }

          // Sort members array
          newMembers.sort((a, b) => a.alias.localeCompare(b.alias));
          setMembers(newMembers);

          // Refilter and evaluate
          filtered = members.filter(x => x.alias.toLowerCase().startsWith(query.toLowerCase()));
          setHasMoreResults({
            ...hasMoreResults,
            [query]: newMembers.length >= config.app.member.query_limit,
          });
        }
        else {
          // Update flag that indicates if there are potentially more results to see
          setHasMoreResults({
            ...hasMoreResults,
            [query]: hasMoreResults[query.slice(0, -1)],
          });
        }
      }}

      searchable
      data={members.map(x => ({ value: x.id, label: x.alias, member: x }))}
    />
  )
}
