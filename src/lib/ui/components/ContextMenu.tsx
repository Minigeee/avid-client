import { HTMLProps, PropsWithChildren, ReactNode, createContext, useContext, useEffect, useState } from 'react';

import {
  Menu,
  MenuDropdownProps,
  MenuProps,
  Portal,
} from '@mantine/core';

import { merge } from 'lodash';


////////////////////////////////////////////////////////////
type ContextMenuState = {
  opened: boolean;
  x: number;
  y: number;
  data: any;
  dropdown: (data: any) => ReactNode;
};

/** Context menu context */
// @ts-ignore
export const ContextMenuContext = createContext<{ state: ContextMenuState; setState: (state: ContextMenuState) => void }>();


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

  return (
    <>
      <Portal>
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
            {state.dropdown(state.data || {})}
          </Menu.Dropdown>
        </Menu>
      </Portal>
      <ContextMenuContext.Provider value={{ state, setState }}>
        {props.children}
      </ContextMenuContext.Provider>
    </>
  );
}


////////////////////////////////////////////////////////////
export function ContextMenuDropdown(props: { children: (data: any) => ReactNode }) {
  const context = useContext(ContextMenuContext);

  useEffect(() => {
    context.setState({ ...context.state, dropdown: props.children });
  }, [props.children]);

  return null;
}

ContextMenu.Dropdown = ContextMenuDropdown;


////////////////////////////////////////////////////////////
type ContextMenuTriggerProps = PropsWithChildren & HTMLProps<HTMLDivElement> & {
  /** Context data that gets passed to the context menu */
  context?: any;
};

////////////////////////////////////////////////////////////
export function ContextMenuTrigger(props: ContextMenuTriggerProps) {
  const context = useContext(ContextMenuContext);

  return (
    <div {...props} onContextMenu={(e) => {
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
