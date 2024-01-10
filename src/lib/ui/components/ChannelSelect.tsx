import { ComponentPropsWithoutRef, forwardRef, useMemo } from 'react';

import { Group, Select, SelectProps, Text } from '@mantine/core';
import { IconHash } from '@tabler/icons-react';

import ChannelIcon from './ChannelIcon';

import { DomainWrapper } from '@/lib/hooks';
import { Channel, ChannelTypes } from '@/lib/types';

////////////////////////////////////////////////////////////
interface ChannelSelectItemProps extends ComponentPropsWithoutRef<'div'> {
  value: string;
  label: string;
  type: ChannelTypes;
}

////////////////////////////////////////////////////////////
const ChannelSelectItem = forwardRef<HTMLDivElement, ChannelSelectItemProps>(
  ({ value, label, ...others }: ChannelSelectItemProps, ref) => (
    <div ref={ref} {...others}>
      <Group spacing='sm'>
        <ChannelIcon type={others.type} size={16} />
        <Text size='sm'>{label}</Text>
      </Group>
    </div>
  ),
);
ChannelSelectItem.displayName = 'ChannelSelectItem';

////////////////////////////////////////////////////////////
export type ChannelSelectProps = Omit<SelectProps, 'data' | 'filter'> & {
  /** Domain used to get channels to display */
  domain: DomainWrapper;
  /** A custom function to decide which channels to display */
  filter?: (channel: Channel) => boolean;
};

////////////////////////////////////////////////////////////
export default function ChannelSelect({
  domain,
  filter,
  ...props
}: ChannelSelectProps) {
  // Get list of channels to display
  const data = useMemo(() => {
    // Group names
    const groups: Record<string, string> = {};
    for (const group of domain.groups) groups[group.id] = group.name;

    // Create list of channels
    let channels = Object.values(domain.channels);
    if (filter) channels = channels.filter(filter);

    return channels.map((ch) => ({
      ...ch,
      value: ch.id,
      label: ch.name,
      group: ch.inherit ? groups[ch.inherit] : undefined,
    }));
  }, [domain.channels, filter]);

  // Channel icon
  const icon = useMemo(() => {
    const channel = props.value ? domain.channels[props.value] : undefined;
    return channel ? (
      <ChannelIcon type={channel.type} size={16} />
    ) : (
      <IconHash size={16} />
    );
  }, [props.value, domain.channels]);

  return (
    <Select
      icon={icon}
      searchable
      {...props}
      data={data}
      itemComponent={ChannelSelectItem}
    />
  );
}
