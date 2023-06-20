import { IconHash, IconListDetails, IconVideo, TablerIconsProps } from '@tabler/icons-react';

import { ChannelTypes } from '@/lib/types';


////////////////////////////////////////////////////////////
type ChannelIconProps = TablerIconsProps & {
  type: ChannelTypes;
}

////////////////////////////////////////////////////////////
export default function ChannelIcon({ type, ...props }: ChannelIconProps) {
  if (type === 'text')
    return (<IconHash {...props} />);
  else if (type === 'rtc')
    return (<IconVideo {...props} />);
  else if (type === 'board')
    return (<IconListDetails {...props} />);
  else
    return null;
}
