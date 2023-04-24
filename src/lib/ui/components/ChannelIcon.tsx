import { Hash, ListDetails, Video } from 'tabler-icons-react';

import { ChannelTypes } from '@/lib/types';


////////////////////////////////////////////////////////////
type ChannelIconProps = {
  type: ChannelTypes;
  size?: number;
  color?: string;
}

////////////////////////////////////////////////////////////
export default function ChannelIcon({ type, ...props }: ChannelIconProps) {
  if (type === 'text')
    return (<Hash {...props} />);
  else if (type === 'rtc')
    return (<Video {...props} />);
  else if (type === 'board')
    return (<ListDetails {...props} />);
  else
    return null;
}
