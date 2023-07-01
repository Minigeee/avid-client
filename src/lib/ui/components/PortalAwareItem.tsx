import { PropsWithChildren } from 'react';
import { DraggableStateSnapshot } from 'react-beautiful-dnd';

import { Portal } from '@mantine/core';


////////////////////////////////////////////////////////////
export default function PortalAwareItem(props: PropsWithChildren & { snapshot: DraggableStateSnapshot; }) {
  if (props.snapshot.isDragging) {
    return (
      <Portal>
        {props.children}
      </Portal>
    );
  }
  else {
    return <>{props.children}</>;
  }
}
