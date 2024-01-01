import { HTMLProps, forwardRef, useMemo } from 'react';
import Image from 'next/image';

import { Avatar, AvatarProps, Sx } from '@mantine/core';

import { ExpandedMember } from '@/lib/types';

////////////////////////////////////////////////////////////
type MemberAvatarProps = Omit<AvatarProps, 'size'> &
  HTMLProps<HTMLDivElement> & {
    member?: Omit<ExpandedMember, 'id' | 'time_joined'> | null;

    size: number;
    color?: string;
    cursor?: 'default' | 'pointer';
  };

////////////////////////////////////////////////////////////
const MemberAvatar = forwardRef<HTMLDivElement, MemberAvatarProps>(
  (props: MemberAvatarProps, ref) => {
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
        return props.member.alias
          .split(/[\s_]+/)
          .map((x) => x.charAt(0))
          .join('')
          .toUpperCase();

      return '';
    }, [props.member?.profile_picture, props.member?.alias]);

    return (
      <Avatar
        {...props}
        ref={ref}
        size={props.size}
        radius={100}
        sx={(theme) => {
          // Get passed in sx
          let sx = {};
          if (props.sx) {
            if (typeof props.sx === 'function') sx = props.sx(theme);
            else sx = props.sx;
          }

          return {
            cursor: props.cursor,
            ...sx,
          };
        }}
      >
        {content}
      </Avatar>
    );
  },
);
MemberAvatar.displayName = 'MemberAvatar';
export default MemberAvatar;

////////////////////////////////////////////////////////////
type AvatarGroupProps = {
  members: ExpandedMember[];

  max: number;
  size: number;
};

////////////////////////////////////////////////////////////
export function AvatarGroup(props: AvatarGroupProps) {}
