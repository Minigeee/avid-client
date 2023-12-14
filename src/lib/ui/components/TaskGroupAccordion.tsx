import { ReactNode, useMemo, useState } from 'react';

import { Accordion, Group, Text } from '@mantine/core';

import { GroupableFields, SingleGrouped } from '../views/projects/BoardView';
import MemberAvatar from './MemberAvatar';

import { DomainWrapper, getMemberSync } from '@/lib/hooks';
import { Label } from '@/lib/types';

import { capitalize } from 'lodash';
import moment from 'moment';

////////////////////////////////////////////////////////////
type TaskGroupAccordionProps = {
  domain: DomainWrapper;
  groups: string[];
  expanded: Record<string, string[]>;
  setExpanded: (value: Record<string, string[]>) => any;
  component: (group: string) => ReactNode;

  tagMap: Record<string, Label>;
  statusMap?: Record<string, Label>;

  collection: string;
  grouper: GroupableFields | null;
};

////////////////////////////////////////////////////////////
export default function TaskGroupAccordion({
  expanded,
  setExpanded,
  grouper,
  ...props
}: TaskGroupAccordionProps) {
  // Create controls once
  const controls = useMemo(() => {
    return props.groups.map((group, group_idx) => (
      <Group key={group} noWrap>
        {grouper === 'assignee' && (
          <MemberAvatar
            member={
              group === '_' ? null : getMemberSync(props.domain.id, group)
            }
            size={32}
          />
        )}
        <Text weight={600} size="lg">
          {(() => {
            if (grouper === 'tags')
              return group === '_'
                ? 'No Tags'
                : props.tagMap[group.trim()].label;
            else if (grouper === 'assignee')
              return group === '_'
                ? 'Unassigned'
                : getMemberSync(props.domain.id, group)?.alias;
            else if (grouper === 'priority')
              return group === '_' ? 'None' : capitalize(group);
            else if (grouper === 'due_date')
              return group === '_' ? 'No Due Date' : moment(group).format('ll');
            else if (grouper === 'status')
              return props.statusMap?.[group.trim()].label;
          })()}
        </Text>
      </Group>
    ));
  }, [grouper, props.groups]);

  // Key used to find expand values
  const expandKey = `${props.collection}.${grouper}`;
  if (!expanded[expandKey])
    setExpanded({ ...expanded, [expandKey]: props.groups });

  return (
    <Accordion
      value={expanded[expandKey] || props.groups}
      onChange={(values) => setExpanded({ ...expanded, [expandKey]: values })}
      multiple
      sx={{
        minWidth: '100ch',
      }}
      styles={(theme) => ({
        item: {
          borderWidth: 2,
        },
      })}
    >
      {props.groups.map((group, group_idx) => (
        <Accordion.Item key={group} value={group}>
          <Accordion.Control>{controls[group_idx]}</Accordion.Control>
          <Accordion.Panel>{props.component(group)}</Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}
