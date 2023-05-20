import { PropsWithChildren } from 'react';

import { MantineColor, Menu, Popover, PopoverDropdownProps, PopoverProps, ScrollArea } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';

import { merge } from 'lodash';


////////////////////////////////////////////////////////////
type SubmenuProps = PropsWithChildren & {
  label: string | JSX.Element;
  icon?: JSX.Element;
  color?: MantineColor;
  maxHeight?: string | number;

  styles?: PopoverProps['styles'];
  dropdownProps?: PopoverDropdownProps;
};

////////////////////////////////////////////////////////////
export default function Submenu(props: SubmenuProps) {
  return (
    <Popover
      position='right-start'
      offset={{ mainAxis: 12, crossAxis: 9 }}
      withArrow
      styles={(theme, params, context) => {
        // Get passed styles
        let styles: PopoverProps['styles'] = {};
        if (props.styles) {
          if (typeof props.styles === 'function')
            styles = props.styles(theme, params, context);
          else
            styles = props.styles;
        }

        return merge({
          dropdown: {
            borderColor: theme.colors.dark[5],
          },
        } as PopoverProps['styles'], styles);
      }}
    >
      <Popover.Target>
        <Menu.Item
          closeMenuOnClick={false}
          icon={props.icon}
          color={props.color}
          rightSection={<IconChevronRight size={16} />}
          sx={(theme) => ({
            alignItems: 'start',
            paddingBottom: '0.5rem',

            '.tabler-icon-chevron-right': {
              color: theme.colors.dark[2],
            },
          })}
        >
          {props.label}
        </Menu.Item>
      </Popover.Target>

      <Popover.Dropdown p={4} {...props.dropdownProps}>
        <ScrollArea.Autosize mah={props.maxHeight || '25rem'}>
          {props.children}
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  )
}
