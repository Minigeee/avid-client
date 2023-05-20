import { DependencyList, HTMLProps, PropsWithChildren, ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
  MantineColor,
  Menu,
  MenuDropdownProps,
  MenuProps,
  Popover,
  PopoverDropdownProps,
  PopoverProps,
  Portal,
  ScrollArea,
} from '@mantine/core';
import { useTimeout } from '@mantine/hooks';
import { IconChevronRight } from '@tabler/icons-react';

import { merge } from 'lodash';


////////////////////////////////////////////////////////////
type ContextMenuState = {
  opened: boolean;
  x: number;
  y: number;
  data: any;
  dropdown: (data: any) => ReactNode;
};

////////////////////////////////////////////////////////////
type SubmenuState = string | null;

/** Context menu context */
// @ts-ignore
export const ContextMenuContext = createContext<{ state: ContextMenuState; setState: (state: ContextMenuState) => void }>();
/** Submenu context */
// @ts-ignore
export const SubmenuContext = createContext<{ submenu: SubmenuState; setSubmenu: (state: SubmenuState) => void }>();


////////////////////////////////////////////////////////////
export type ContextMenuProps = PropsWithChildren & MenuProps & {
  dropdownProps?: MenuDropdownProps;
};

////////////////////////////////////////////////////////////
export function ContextMenu(props: ContextMenuProps) {
  const [state, setState] = useState<ContextMenuState>({
    opened: false,
    x: 0,
    y: 0,
    data: null,
    dropdown: () => null,
  });
  const [submenu, setSubmenu] = useState<SubmenuState>(null);

  // Only rerender dropdown when state changes
  const dropdown = useMemo(() => state.dropdown(state.data || {}), [state]);

  // Reset submenu when close
  useEffect(() => {
    if (!state.opened)
      setSubmenu(null);
  }, [state.opened]);


  return (
    <>
      <Portal>
        <SubmenuContext.Provider value={{ submenu, setSubmenu }}>
          <Menu
            {...props}
            opened={state.opened}
            position='bottom-start'
            offset={-1}
            onChange={(opened) => { setState({ ...state, opened }) }}

            styles={(theme, params, context) => {
              // Get passed styles
              let styles: MenuProps['styles'] = {};
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
                divider: {
                  borderColor: theme.colors.dark[5],
                },
              } as MenuProps['styles'], styles);
            }}
          >
            <Menu.Target>
              <div style={{
                position: 'absolute',
                left: state.x,
                top: state.y,
              }} />
            </Menu.Target>
            <Menu.Dropdown {...props.dropdownProps}>
              {dropdown}
            </Menu.Dropdown>
          </Menu>
        </SubmenuContext.Provider>
      </Portal>
      <ContextMenuContext.Provider value={{ state, setState }}>
        {props.children}
      </ContextMenuContext.Provider>
    </>
  );
}


////////////////////////////////////////////////////////////
export function ContextMenuDropdown(props: { dependencies?: DependencyList; children: (data: any) => ReactNode }) {
  const context = useContext(ContextMenuContext);

  // Child function should never change
  useEffect(() => {
    context.setState({ ...context.state, dropdown: props.children });
  }, props.dependencies || undefined);

  return null;
}

ContextMenu.Dropdown = ContextMenuDropdown;


////////////////////////////////////////////////////////////
type ContextMenuTriggerProps = PropsWithChildren & HTMLProps<HTMLDivElement> & {
  /** Context data that gets passed to the context menu */
  context?: any;
  /** Set this to true to prevent context menu from trigger, does default behavior instead */
  disabled?: boolean;
};

////////////////////////////////////////////////////////////
export function ContextMenuTrigger(props: ContextMenuTriggerProps) {
  const context = useContext(ContextMenuContext);

  return (
    <div {...props} onContextMenu={(e) => {
      if (props.disabled) return;

      // Prevent default
      e.preventDefault();
      e.stopPropagation();

      // Set context
      context.setState({
        ...context.state,
        opened: true,
        x: e.clientX,
        y: e.clientY,
        data: props.context,
      });
    }}>
      {props.children}
    </div>
  );
}

ContextMenu.Trigger = ContextMenuTrigger;


////////////////////////////////////////////////////////////
type ContextMenuSubmenuProps = PropsWithChildren & {
  id: string;
  label: string | JSX.Element;
  icon?: JSX.Element;
  color?: MantineColor;
  maxHeight?: string | number;
  hoverDelay?: number;

  styles?: PopoverProps['styles'];
  dropdownProps?: PopoverDropdownProps;
};

////////////////////////////////////////////////////////////
export function ContextMenuSubmenu(props: ContextMenuSubmenuProps) {
  const { submenu, setSubmenu } = useContext(SubmenuContext);

  const openTimeout = useTimeout(
    () => setSubmenu(props.id),
    props.hoverDelay || 150
  );

  return useMemo(() => (
    <Popover
      opened={submenu === props.id}
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

          onMouseEnter={() => openTimeout.start()}
          onMouseLeave={(e) => openTimeout.clear()}
          onClick={() => setSubmenu(props.id)}
        >
          {props.label}
        </Menu.Item>
      </Popover.Target>

      <Popover.Dropdown
        p={4}
        {...props.dropdownProps}
      >
        <ScrollArea.Autosize mah={props.maxHeight || '25rem'}>
          {props.children}
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  ), [props, submenu]);
}

ContextMenu.Submenu = ContextMenuSubmenu;