import { ExoticComponent, RefObject, forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Accordion,
  CloseButton,
  Divider,
  Group,
  Indicator,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  UnstyledButton
} from '@mantine/core';
import { useDebouncedValue, useIntersection } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';

import MemberAvatar from '@/lib/ui/components/MemberAvatar';

import config from '@/config';
import { DomainWrapper, listMembers, listMembersLocal, useMemberQuery, useSession } from '@/lib/hooks';
import { ExpandedMember, Role } from '@/lib/types';

import { range, throttle } from 'lodash';
import MemberPopover from '../../components/MemberPopover';


////////////////////////////////////////////////////////////
type MembersPageProps = {
  containerRef: RefObject<HTMLDivElement>;

  domain_id: string;
  page: number;
  total: number;
  online: boolean;
  search: string;
  debouncedSearch: string;

  MemberListItem: ExoticComponent<any>;
};

////////////////////////////////////////////////////////////
function MembersPage({ MemberListItem, ...props }: MembersPageProps) {
  const limit = config.app.member.query_limit;
  const numElems = props.total - props.page * limit;
  
  const { ref: pageRef, entry } = useIntersection({ root: props.containerRef.current, threshold: 0 });

  const [intersecting, setIntersecting] = useState<boolean>(props.page === 0);
  const [isIntersecting] = useDebouncedValue(intersecting, 200);
  useEffect(() => {
    if (!entry) return;
    setIntersecting(entry.isIntersecting);
  }, [entry?.isIntersecting || false]);

  // Only load query if intersecting
  const members = useMemberQuery(props.page === 0 && entry?.isIntersecting || isIntersecting ? props.domain_id : undefined, {
    page: props.page,
    online: props.online,
    search: props.debouncedSearch,
  });


  // Filter search results
  const filtered = useMemo(() => {
    if (!isIntersecting || !props.search && members._exists)
      return members.data || [];

    if (!members._exists) {
      const limit = config.app.member.query_limit;
      return listMembersLocal(props.domain_id, { search: props.search }).slice(props.page * limit, (props.page + 1) * limit);
    }

    const search = props.search.toLocaleLowerCase();
    return members.data.filter(x => x.alias.toLocaleLowerCase().indexOf(search) >= 0);
  }, [members.data, props.search]);


  if (!isIntersecting)
    return (<div ref={pageRef} style={{ height: `${numElems * 2.6}rem` }} />);
  else {
    return (
      <Stack ref={pageRef} spacing={0}>
        {filtered.map((member) => (
          <MemberListItem
            key={member.id}
            member={member}
            online={props.online}
          />
        ))}
      </Stack>
    );
  }
}


////////////////////////////////////////////////////////////
function MembersTab(props: RightPanelViewProps) {
  // Used for infinite scroll
  const containerRef = useRef<HTMLDivElement>(null);

  // Real time search value
  const [search, setSearch] = useState<string>('');
  const [debouncedSearchRaw] = useDebouncedValue(search, 500);
  const debouncedSearch = search ? debouncedSearchRaw : '';

  // Get member counts
  const allMembers = useMemberQuery(props.domain.id, { search: debouncedSearch }); // Use all member query bc it will be used elsewhere (reduce query calls)
  const online = useMemberQuery(props.domain.id, { online: true, search: debouncedSearch });
  const counts = useMemo(() => {
    if (allMembers._exists && online._exists && search === debouncedSearch) return { total: allMembers.count, online: online.count };

    const filtered = listMembersLocal(props.domain.id, { search });
    const onlineFiltered = filtered.filter(x => x.online);
    return {
      total: Math.max(filtered.length, allMembers.count || 0),
      online: Math.max(onlineFiltered.length, online.count || 0),
    };
  }, [allMembers.count, online.count, search]);
  
  const offline = { count: counts.total - counts.online };


  // Member item
  const MemberListItem = useMemo(() => {
    const component = memo(forwardRef<HTMLDivElement, { member: ExpandedMember; online?: boolean }>(
      ({ member, online, ...others }, ref) => {
        let alias = member.alias.replace(/<[^>]*>/g, '');
        if (search.length > 0) {
          const idx = alias.toLocaleLowerCase().indexOf(search.toLocaleLowerCase());
          if (idx >= 0)
            alias = `${alias.slice(0, idx)}<b>${alias.slice(idx, idx + search.length)}</b>${alias.slice(idx + search.length)}`;
        }

        return (
          <MemberPopover domain={props.domain} member={member} popoverProps={{ position: 'left-start' }} withinPortal>
            <UnstyledButton
              sx={(theme) => ({
                padding: '0rem 0.5rem',
                borderRadius: theme.radius.sm,
                '&:hover': {
                  backgroundColor: theme.colors.dark[5],
                },
              })}
            >
              <Group ref={ref} {...others} spacing={6} noWrap sx={{
                height: '2.6rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                opacity: online ? undefined : 0.6,
              }}>
                <Indicator
                  inline
                  position='bottom-end'
                  offset={4}
                  size={12}
                  color='teal'
                  withBorder
                  disabled={!online}
                >
                  <MemberAvatar size={32} member={member} />
                </Indicator>
                <Text
                  ml={6}
                  size='sm'
                  weight={search.length > 0 ? 400 : 600}
                  sx={(theme) => ({ color: theme.colors.gray[4] })}
                  dangerouslySetInnerHTML={{ __html: alias }}
                />
              </Group>
            </UnstyledButton>
          </MemberPopover>
        );
      }
    ));
    component.displayName = 'MemberListItem';

    return component;
  }, [search]);


  // Calculations
  const limit = config.app.member.query_limit;
  const numPages = {
    online: Math.ceil(counts.online / limit),
    offline: Math.ceil((offline.count || 0) / limit),
  };

  
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

      <ScrollArea p={8} ref={containerRef} sx={{ flexGrow: 1 }}>
        <Accordion
          multiple
          defaultValue={['online']}
          styles={(theme) => ({
            control: {
              paddingLeft: 0,
              paddingRight: '0.25rem',
              borderRadius: theme.radius.sm,
              '&:hover': {
                backgroundColor: theme.colors.dark[5],
              },
            },
            label: {
              padding: '0.4rem 0.5rem',
              fontSize: theme.fontSizes.sm,
              fontWeight: 600,
              color: theme.colors.dark[2],
            },
            item: {
              borderBottom: 'none',
            },
            content: {
              padding: 0,
            },
          })}
        >
          <Accordion.Item value='online'>
            <Accordion.Control>Online - {counts.online}</Accordion.Control>
            <Accordion.Panel>
              <Stack mb={16} spacing={0}>
                {range(numPages.online).map(i => (
                  <MembersPage
                    key={i}
                    containerRef={containerRef}
                    domain_id={props.domain.id}
                    page={i}
                    total={online.count || 0}
                    online
                    search={search}
                    debouncedSearch={debouncedSearch}
                    MemberListItem={MemberListItem}
                  />
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value='offline'>
            <Accordion.Control>Offline - {offline.count || 0}</Accordion.Control>
            <Accordion.Panel>
              <Stack mb={16} spacing={0}>
                {range(numPages.offline).map(i => (
                  <MembersPage
                    key={i}
                    containerRef={containerRef}
                    domain_id={props.domain.id}
                    page={i}
                    total={offline.count || 0}
                    online={false}
                    search={search}
                    debouncedSearch={debouncedSearch}
                    MemberListItem={MemberListItem}
                  />
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
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
