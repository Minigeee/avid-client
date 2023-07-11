import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Accordion,
  CloseButton,
  Divider,
  Group,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  UnstyledButton
} from '@mantine/core';
import { useDebouncedValue, useIntersection } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';

import config from '@/config';
import { DomainWrapper, useSession } from '@/lib/hooks';
import { MemberListOptions, MemberListResults, listMembers } from '@/lib/db';
import { ExpandedMember } from '@/lib/types';
import MemberAvatar from '../../components/MemberAvatar';


/** Page size */
const PSIZE = config.app.member.new_query_threshold;


////////////////////////////////////////////////////////////
type MemberListInfiniteOptions = {
  /** Search string */
  search?: string;
  /** Number of pages to load */
  size?: number;
};

////////////////////////////////////////////////////////////
type QueryMetadata = {
  /** Total number of entries that match query */
  count?: number;
  /** The total number of pages that have been loaded for this query */
  size: number;
  /** Indicates if this query is fetching */
  loading?: boolean;
};

////////////////////////////////////////////////////////////
function useMemberInfinite(domain_id: string, search: string) {
  // Normalize search term
  search = search.toLocaleLowerCase();

  const session = useSession();

  // Debounced search value (for performing fetches)
  const [debouncedSearch] = useDebouncedValue(search, 500, { leading: true });
  // Cumulative list of all members searched for
  const [members, setMembers] = useState<ExpandedMember[]>([]);

  // Used to track if member query has retrieved all members
  const [queries, setQueries] = useState<Record<string, QueryMetadata>>({});
  // Queue of fetch requests
  const [fetchReqs, setFetchReqs] = useState<(() => Promise<MemberListResults>)[]>([]);
  // Used to indicate when next fetch req should start
  const [nextReqToggle, setNextReqToggle] = useState<boolean>(false);


  // List of members filtered to match options
  const filtered = useMemo(() => {
    if (!search) return members;

    // Map of member to the subquery
    const substrIdx: Record<string, number> = {};
    for (const m of members)
      substrIdx[m.id] = m.alias.toLocaleLowerCase().indexOf(search);

    // Filtered list
    const filtered = members.filter(m => substrIdx[m.id] >= 0);
    filtered.sort((a, b) => substrIdx[a.id] === substrIdx[b.id] ? a.alias.localeCompare(b.alias) : substrIdx[a.id] - substrIdx[b.id]);

    return filtered;
  }, [members, search]);

  // Handles change of query options
  useEffect(() => {
    // Search referst to debounced value in this function
    const search = debouncedSearch;

    // Get query metadata
    let query = queries[search];
    if (!query) {
      query = { size: 1 };
      setQueries({ ...queries, [search]: query });
    }

    // Get number of members that are required to be loaded
    const needLoaded = query.size * PSIZE;
    // Get current members that match criteria
    const filtered = members.filter(m => m.alias.toLocaleLowerCase().includes(search));

    // Fetch function
    const fn = async () => {
      const results = await listMembers(domain_id, { search, page: query.size - 1 }, session);
      // Update query entry
      setQueries({ ...queries, [search]: { size: query.size, count: results.count, loading: false } });

      return results;
    };

    // Check if more values need to be loaded
    if (filtered.length < needLoaded) {
      if (query.count !== undefined) {
        // Total number of members for this query is known, perform fetch if there are still members to be retrieved
        if (filtered.length < query.count) {
          setFetchReqs([...fetchReqs, fn]);
          setQueries({ ...queries, [search]: { ...query, loading: true } });
        }
      }
      else {
        // The total count for current query is unknown, check previous query to see if more needs to be fetched
        const prev = queries[search.slice(0, -1)];

        // Check if prev count is greater than single page (<single page is minimum needed to skip fetch)
        if (prev?.count !== undefined && prev.count > PSIZE) {
          setFetchReqs([...fetchReqs, fn]);
          setQueries({ ...queries, [search]: { ...query, loading: true } });
        }
      }
    }
    // Do nothing if the number that is needed to be loaded is greater than

    // Downside to this method: if the user searches for members later down the list, those will be loaded and used in the next search
    // When the user does next search, the results list may show values early in the list and late in the list (bc of the initial search)
    // but not those in the middle bc the total number of current results may > page size (therefore not triggering a fetch)
    // I think this is a minor issue that is not important enough to address
  }, [debouncedSearch, queries[debouncedSearch]?.size]);

  // Handles fetch requests
  useEffect(() => {
    if (!fetchReqs.length) return;

    fetchReqs[0]().then((results) => {
      const newMembers = results.data;

      // Merge members lists
      const memberMap: Record<string, ExpandedMember> = {};
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

      // Remove this fetch req from list
      const copy = fetchReqs.slice();
      copy.splice(0);
      setFetchReqs(copy);
      setNextReqToggle(!nextReqToggle);
    });
  }, [fetchReqs.length > 0, nextReqToggle]);

  // Used to fetch first batch of members
  useEffect(() => {
    listMembers(domain_id, { search, page: 0 }, session).then(results => {
      setMembers(results.data);
      setQueries({ ...queries, ['']: { size: 1, count: results.count } });
    });
  }, []);


  // Function used to load next page
  const next = () => {
    const query = queries[debouncedSearch];
    // In order toload next page, query obj (w/ member count) must exist, number loaded members must be less than total, and this query can not be loading
    if (query && (query.count !== undefined && query.size * PSIZE < query.count) && !query.loading)
      setQueries({ ...queries, [debouncedSearch]: { ...query, size: query.size + 1 } });
  };
  
  // Member item
  const MemberListItem = useMemo(() => {
    const component = forwardRef<HTMLDivElement, { member: ExpandedMember }>(
      ({ member, ...others }, ref) => {
        let alias = member.alias;
        if (search.length > 0) {
          const idx = alias.toLocaleLowerCase().indexOf(search.toLocaleLowerCase());
          if (idx >= 0)
            alias = `${alias.slice(0, idx)}<b>${alias.slice(idx, idx + search.length)}</b>${alias.slice(idx + search.length)}`;
        }

        return (
          <Group ref={ref} {...others} noWrap sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            <MemberAvatar size={32} member={member} />
            <Text size='sm' weight={search.length > 0 ? 400 : 600} sx={(theme) => ({ color: theme.colors.gray[4] })} dangerouslySetInnerHTML={{ __html: alias }} />
          </Group>
        );
      }
    );
    component.displayName = 'MemberListItem';

    return component;
  }, [search]);


  return {
    members,
    filtered,
    MemberListItem,
    _loading: queries[search] === undefined ? true : queries[search].loading || false,
    _next: next,
  };
}

////////////////////////////////////////////////////////////
function MembersTab(props: RightPanelViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { ref: nextTriggerRef, entry: nextTrigger } = useIntersection({ root: containerRef.current, threshold: 0.5 });

  // Real time search value
  const [search, setSearch] = useState<string>('');

  // Members
  const { filtered, MemberListItem, _loading, _next } = useMemberInfinite(props.domain.id, search);

  // Called when next trigger comes into view
  useEffect(() => {
    // Go next if not loading
    if (nextTrigger?.isIntersecting && !_loading)
      _next();
  }, [nextTrigger?.isIntersecting]);

  
  return (
    <>
      <TextInput
        m={8}
        placeholder='Search members'
        icon={<IconSearch size={18} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        rightSection={search.length > 0 ? (
          <CloseButton
            onClick={() => setSearch('')}
          />
        ) : undefined}
      />

      <Divider sx={(theme) => ({ color: theme.colors.dark[5], borderColor: theme.colors.dark[5] })} />

      <ScrollArea m={8} ref={containerRef} sx={{ flexGrow: 1 }}>
        <Stack spacing={0}>
          {filtered.map((member, i) => (
            <UnstyledButton
              ref={i === filtered.length - 10 ? nextTriggerRef : undefined}
              sx={(theme) => ({
                padding: '0.25rem 0.4rem',
                borderRadius: theme.radius.sm,
                '&:hover': { backgroundColor: theme.colors.dark[5] }
              })}
            >
              <MemberListItem member={member} />
            </UnstyledButton>
          ))}
        </Stack>
      </ScrollArea>
    </>
  );
}


////////////////////////////////////////////////////////////
type RightPanelViewProps = {
  domain: DomainWrapper;
};

////////////////////////////////////////////////////////////
export default function RightPanelView(props: RightPanelViewProps) {


  return (
    <>
      <MembersTab {...props} />
    </>
  )
}
