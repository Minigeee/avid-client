import { useMemo } from 'react';
import Image from 'next/image';

import {
  Avatar,
} from '@mantine/core';

import { ProfileWrapper } from '@/lib/hooks';


////////////////////////////////////////////////////////////
type ProfileAvatarProps = {
  profile: ProfileWrapper;

  size: number;
  color?: string;
  onClick?: () => void;
};

////////////////////////////////////////////////////////////
export default function ProfileAvatar({ profile, ...props }: ProfileAvatarProps) {
  // Avatar content
  const content = useMemo<string | JSX.Element>(() => {
    if (profile.profile_picture)
      return (
        <Image
          src={profile.profile_picture}
          alt={profile.username}
          width={props.size}
          height={props.size}
        />
      );
    else if (profile.username)
      return profile.username.split(/[\s_]+/).map(x => x.charAt(0)).join('').toUpperCase();

    return '';
  }, [profile.profile_picture, profile.username]);

  return (
    <Avatar
      size={props.size}
      radius={props.size}
      sx={(theme) => ({
        backgroundColor: props.color || '#333333',
      })}
      onClick={() => props.onClick?.()}
    >
      {content}
    </Avatar>
  );
}