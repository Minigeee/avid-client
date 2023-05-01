import { useState } from 'react';

import {
  Box,
  ScrollArea,
  Transition,
} from '@mantine/core';

import KanbanView from './KanbanView';
import ListView from './ListView';

import {
  DomainWrapper,
  useBoard,
  useTasks,
} from '@/lib/hooks';
import { Channel } from '@/lib/types';


////////////////////////////////////////////////////////////
type BoardViewProps = {
  channel: Channel<'board'>;
  domain: DomainWrapper;
  view?: 'list' | 'kanban';
}

////////////////////////////////////////////////////////////
export default function BoardView(props: BoardViewProps) {
  const board = useBoard(props.channel.data?.board);
  const tasks = useTasks(board.id);

  return (
    <>
      <ScrollArea sx={{
        width: '100%',
        height: '100%',
      }}>
        {board._exists && tasks._exists && (
          <>
            {props.view === 'list' && <ListView board={board} tasks={tasks} domain={props.domain} />}
            {(!props.view || props.view === 'kanban') && (
              <KanbanView board={board} tasks={tasks} domain={props.domain} />
            )}
          </>
        )}
      </ScrollArea>
    </>
  );
}
