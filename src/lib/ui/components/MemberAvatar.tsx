import { useMemo } from 'react';
import Image from 'next/image';

import {
  Avatar,
  Sx,
} from '@mantine/core';

import { Member } from '@/lib/types';


////////////////////////////////////////////////////////////
type MemberAvatarProps = {
  member?: Omit<Member, 'id' | 'time_joined'> | null;

  size: number;
  color?: string;
  borderColor?: string;
  sx?: Sx;
}

////////////////////////////////////////////////////////////
export default function MemberAvatar(props: MemberAvatarProps) {
  // Avatar content
  const content = useMemo<string | JSX.Element>(() => {
    if (props.member?.profile_picture)
      return (
        <Image
          src={props.member.profile_picture}
          alt={props.member.alias}
          width={props.size}
          height={props.size}
        />
      );
    else if (props.member?.alias)
      return props.member.alias.split(/[\s_]+/).map(x => x.charAt(0)).join('').toUpperCase();

    return '';
  }, [props.member?.profile_picture, props.member?.alias]);

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


////////////////////////////////////////////////////////////
type AvatarGroupProps = {
  members: Member[];

  max: number;
  size: number;
}

////////////////////////////////////////////////////////////
export function AvatarGroup(props: AvatarGroupProps) {

}
