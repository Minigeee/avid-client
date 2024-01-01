import {
  DependencyList,
  HTMLProps,
  MouseEventHandler,
  PropsWithChildren,
  ReactNode,
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Box,
  BoxProps,
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
import { FloatingPosition } from '@mantine/core/lib/Floating';

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
export const ContextMenuContext = createContext<{
  state: ContextMenuState;
  setState: (state: ContextMenuState) => void;
}>();
/** Submenu context */
// @ts-ignore
export const SubmenuContext = createContext<{
  submenu: SubmenuState;
  setSubmenu: (state: SubmenuState) => void;
}>();

////////////////////////////////////////////////////////////
export type ContextMenuProps = PropsWithChildren &
  MenuProps & {
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
    if (!state.opened) setSubmenu(null);
  }, [state.opened]);

  return (
    <>
      <Portal
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <SubmenuContext.Provider value={{ submenu, setSubmenu }}>
          <Menu
            {...props}
            opened={state.opened}
            position='bottom-start'
            offset={-1}
            onChange={(opened) => {
              setState({ ...state, opened });
            }}
          >
            <Menu.Target>
              <div
                style={{
                  position: 'absolute',
                  left: state.x,
                  top: state.y,
                }}
              />
            </Menu.Target>
            <Menu.Dropdown
              {...props.dropdownProps}
              sx={(theme) => {
                // Get passed in sx
                let sx = {};
                if (props.dropdownProps?.sx) {
                  if (typeof props.dropdownProps.sx === 'function')
                    sx = props.dropdownProps.sx(theme);
                  else sx = props.dropdownProps.sx;
                }

                return {
                  boxShadow: theme.other.elements.context_menu_shadow,
                  ...sx,
                };
              }}
            >
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
export type ContextMenuDropdownProps = {
  /** A list of variables the dropdown menu depends on. This is equivalent to `useEffect()` dependency list */
  dependencies: DependencyList;
  children: (data: any) => ReactNode;
};

////////////////////////////////////////////////////////////
export function ContextMenuDropdown(props: ContextMenuDropdownProps) {
  const context = useContext(ContextMenuContext);

  // Child function should never change
  useEffect(() => {
    context.setState({ ...context.state, dropdown: props.children });
  }, props.dependencies || []);

  return null;
}

ContextMenu.Dropdown = ContextMenuDropdown;

////////////////////////////////////////////////////////////
type ContextMenuTriggerProps = PropsWithChildren &
  Omit<HTMLProps<HTMLDivElement>, 'ref'> &
  BoxProps & {
    /** Context data that gets passed to the context menu */
    context?: any;
    /** Set this to true to prevent context menu from trigger, does default behavior instead */
    disabled?: boolean;
  };

////////////////////////////////////////////////////////////
export const ContextMenuTrigger = forwardRef<
  HTMLDivElement,
  ContextMenuTriggerProps
>((props, ref) => {
  const context = useContext(ContextMenuContext);

  return (
    <Box
      ref={ref}
      {...{ ...props, context: undefined }}
      onContextMenu={(e) => {
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
      }}
    >
      {props.children}
    </Box>
  );
});
ContextMenuTrigger.displayName = 'ContextMenu.Trigger';
ContextMenu.Trigger = ContextMenuTrigger;

////////////////////////////////////////////////////////////
export function SubmenuProvider(props: PropsWithChildren & MenuProps) {
  const [opened, setOpened] = useState<boolean>(false);
  const [submenu, setSubmenu] = useState<SubmenuState>(null);

  // Reset submenu when close
  useEffect(() => {
    if (!opened) setSubmenu(null);
  }, [opened]);

  return (
    <SubmenuContext.Provider value={{ submenu, setSubmenu }}>
      <Menu
        {...props}
        onOpen={() => setOpened(true)}
        onClose={() => setOpened(false)}
      >
        {props.children}
      </Menu>
    </SubmenuContext.Provider>
  );
}

////////////////////////////////////////////////////////////
type SubmenuProps = PropsWithChildren & {
  id: string;
  label: string | JSX.Element;
  icon?: JSX.Element;
  color?: MantineColor;
  position?: FloatingPosition;
  hoverDelay?: number;
  maxHeight?: string | number;
  noScroll?: boolean;

  styles?: PopoverProps['styles'];
  dropdownProps?: PopoverDropdownProps;
};

////////////////////////////////////////////////////////////
export function Submenu(props: SubmenuProps) {
  const { submenu, setSubmenu } = useContext(SubmenuContext);

  const openTimeout = useTimeout(
    () => setSubmenu(props.id),
    props.hoverDelay || 150,
  );

  return useMemo(
    () => (
      <Popover
        opened={submenu === props.id}
        position={props.position || 'right-start'}
        offset={{ mainAxis: 12, crossAxis: 9 }}
        withArrow
        styles={(theme, params, context) => {
          // Get passed styles
          let styles: PopoverProps['styles'] = {};
          if (props.styles) {
            if (typeof props.styles === 'function')
              styles = props.styles(theme, params, context);
            else styles = props.styles;
          }

          return merge(
            {
              dropdown: {
                borderColor: theme.other.colors.page_border,
              },
            } as PopoverProps['styles'],
            styles,
          );
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
                color: theme.other.colors.page_dimmed,
              },
            })}
            onMouseEnter={() => openTimeout.start()}
            onMouseLeave={(e) => openTimeout.clear()}
            onClick={() => setSubmenu(props.id)}
          >
            {props.label}
          </Menu.Item>
        </Popover.Target>

        <Popover.Dropdown p={4} {...props.dropdownProps}>
          {!props.noScroll && (
            <ScrollArea.Autosize mah={props.maxHeight || '25rem'}>
              {props.children}
            </ScrollArea.Autosize>
          )}
          {props.noScroll && props.children}
        </Popover.Dropdown>
      </Popover>
    ),
    [props, submenu],
  );
}

ContextMenu.Submenu = Submenu;
