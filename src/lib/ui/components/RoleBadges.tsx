import { useMemo } from 'react';

import { Group, GroupProps, Tooltip } from '@mantine/core';

import { Emoji } from './Emoji';

import { Role } from '@/lib/types';
import { DomainWrapper } from '@/lib/hooks';


////////////////////////////////////////////////////////////
export type BadgeMap = Record<string, { index: number; badge: JSX.Element }>;

////////////////////////////////////////////////////////////
export function useRoleBadges(domain: DomainWrapper, props?: { size?: number; cursor?: 'default' | 'pointer' }) {
  // Create map of role badges, skipping ones that are hidden
  return useMemo(() => {
    // Map of badges
    const badges: BadgeMap = {};
    for (let i = 0; i < domain.roles.length; ++i) {
      const role = domain.roles[i];
      // Skip if no badge, or not showing
      if (!role.badge || role.show_badge === false) continue;

      // Add to map
      badges[role.id] = {
        index: i,
        badge: (
          <Tooltip label={role.label} position='top-start' withArrow>
            <div style={{ cursor: props?.cursor || 'default' }}><Emoji id={role.badge} size={props?.size || 14} /></div>
          </Tooltip>
        ),
      };
    }
    
    return badges;
  }, [domain.roles]);
}


////////////////////////////////////////////////////////////
type RoleBadgesProps = GroupProps & {
  role_ids: string[];
  badges: BadgeMap;
};

////////////////////////////////////////////////////////////
export default function RoleBadges(props: RoleBadgesProps) {
  // Badge array
  const badges = useMemo(() => {
    // Create list of role ids, sort by role order
    const roleIds: string[] = props.role_ids || [];
    const sorted = roleIds.filter(x => props.badges[x]).sort((a, b) => props.badges[a].index - props.badges[b].index);
    return sorted.map(x => props.badges[x].badge);
  }, [props.badges, props.role_ids]);

  if (badges.length) {
    return (
      <Group spacing={2} mb={2} {...props}>
        {badges}
      </Group>
    );
  }
  else {
    return null;
  }
}
