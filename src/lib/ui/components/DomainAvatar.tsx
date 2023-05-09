import { useMemo } from 'react';

import {
  Avatar,
  Sx,
} from '@mantine/core';

import { DomainWrapper } from '@/lib/hooks';


////////////////////////////////////////////////////////////
type DomainAvatarProps = {
  domain: DomainWrapper;

  size: number;
  color?: string;
  sx?: Sx;
}

////////////////////////////////////////////////////////////
export default function DomainAvatar(props: DomainAvatarProps) {
  // Avatar content
  const content = useMemo<string | JSX.Element>(() => {
    if (props.domain.name)
      return props.domain.name.split(/[\s_]+/).map(x => x.charAt(0)).join('').toUpperCase();

    return '';
  }, [props.domain.name]);

  return (
    <Avatar size={props.size} radius={100} sx={(theme) => {
      // Get passed in sx
      let sx = {};
      if (props.sx) {
        if (typeof props.sx === 'function')
          sx = props.sx(theme);
        else
          sx = props.sx;
      }

      return {
        backgroundColor: props.color || '#333333',
        borderWidth: 0,
        ...sx
      };
    }}>
      {content}
    </Avatar>
  );
}
