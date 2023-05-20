import { useMemo, useState } from 'react';

import TaskGroupAccordion from '@/lib/ui/components/TaskGroupAccordion';
import TaskTable from './components/TaskTable';
import { GroupableFields, NoGrouped, SingleGrouped } from './BoardView';

import config from '@/config';
import {
  BoardWrapper,
  DomainWrapper,
  TasksWrapper,
} from '@/lib/hooks';
import { Label } from '@/lib/types';


////////////////////////////////////////////////////////////
type ListViewProps = {
  board: BoardWrapper;
  tasks: TasksWrapper;
  domain: DomainWrapper;
  collection: string;

  filtered: NoGrouped | SingleGrouped;
  setFiltered: (filtered: NoGrouped | SingleGrouped) => any;
  grouper: GroupableFields | null;
}

////////////////////////////////////////////////////////////
export default function ListView({ board, filtered, grouper, ...props }: ListViewProps) {
  // Currently expanded fields per group by view
  const [expanded, setExpanded] = useState<Record<string, string[]>>({});
  // Memo this so it doesn't change every render
  const groups = useMemo<string[]>(() => Object.keys(filtered), [filtered]);


  // Tag map
  const tagMap = useMemo<Record<string, Label>>(() => {
    const map: Record<string, Label> = {};
    for (const tag of board.tags)
      map[tag.id] = tag;
    return map;
  }, [board.tags]);

  // Status map
  const statusMap = useMemo<Record<string, Label & { index: number }>>(() => {
    const map: Record<string, Label & { index: number }> = {};
    for (let i = 0; i < board.statuses.length; ++i) {
      const s = board.statuses[i];
      map[s.id] = { ...s, index: i };
    }
    return map;
  }, [board.statuses]);


  return (
    <>
      {grouper && (
        <TaskGroupAccordion
          domain={props.domain}
          groups={groups}
          expanded={expanded}
          setExpanded={setExpanded}

          component={(group) => (
            <TaskTable
              board={board}
              domain={props.domain}
              collection={props.collection}
              tasks={(filtered as SingleGrouped)[group]}
              tasksWrapper={props.tasks}
              groupingField={grouper}
              group={group}
              statuses={statusMap}
              tags={tagMap}
            />
          )}

          tagMap={tagMap}
          collection={props.collection}
          grouper={grouper}
          statusMap={statusMap}
        />
      )}
      {!grouper && (
        <TaskTable
          board={board}
          domain={props.domain}
          collection={props.collection}
          tasks={filtered as NoGrouped}
          tasksWrapper={props.tasks}
          groupingField={grouper}
          group={''}
          statuses={statusMap}
          tags={tagMap}
        />
      )}
    </>
  );
}
