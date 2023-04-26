import { forwardRef, useEffect, useState, useImperativeHandle } from 'react';

import {
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';

import { mergeAttributes } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Mention, { MentionOptions } from '@tiptap/extension-mention';
import { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import tippy, { Instance, Props as TippyProps } from 'tippy.js';

import config from '@/config';
import { SessionState } from '@/lib/contexts';
import { listMembers } from '@/lib/db';
import { Member, Role } from '@/lib/types';
import { DomainWrapper } from '@/lib/hooks';


////////////////////////////////////////////////////////////
type SuggestionType = {
  id: string;
  type: 'member' | 'role';
  name: string;
  color?: string;
}


////////////////////////////////////////////////////////////
type PingMentionOptions = MentionOptions & {
  session: SessionState;
  domain: DomainWrapper;
};

////////////////////////////////////////////////////////////
type PingMentionStorage = {
  session: SessionState;
  domain: DomainWrapper;
  has_more_results: Record<string, boolean>;
  members: Member[];
};

////////////////////////////////////////////////////////////
const PingMention = Mention.extend<PingMentionOptions, PingMentionStorage>({
  name: 'pingMention',

  addAttributes() {
    return {
      id: '',
      name: '',
      type: '',
    };
  },

  addStorage() {
    return {
      session: this.options.session,
      domain: this.options.domain,
      has_more_results: {'': true},
      members: [],
    };
  },

  onCreate() {
    // Get initial members list
    listMembers(this.options.domain.id, '', this.options.session)
      .then(members => {
        // Copy members array to storage
        this.storage.members = members;

        // Determine if more results are available by if query limit is reached
        this.storage.has_more_results[''] = members.length >= config.app.member.query_limit;
      });
  },

  renderHTML({ HTMLAttributes, node }) {
    const { attrs } = node;
    
    // Construct attrs
    const finalAttrs: any = {
      class: `highlight${attrs.type === 'member' ? ' mention-member' : ''}`,
    };

    if (attrs.type === 'role') {
      const color = attrs.color || '#EAECEF';
      finalAttrs['style'] = `background-color: ${color}2A; color: ${color}; font-weight: 600;`;
    }

    return [
      'span',
      finalAttrs,
      this.options.renderLabel({
        options: this.options,
        node,
      }),
    ];
  },
});


////////////////////////////////////////////////////////////
const MentionList = forwardRef((props: SuggestionProps<SuggestionType>, ref) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const selectItem = (index: number) => {
    const item = props.items[index]

    if (item) {
      props.command(item);
    }
  }

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - (selectedIndex < 0 ? 0 : 1)) % props.items.length);
  }

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  }

  const enterHandler = () => {
    if (selectedIndex >= 0)
      selectItem(selectedIndex);
  }

  useEffect(() => setSelectedIndex(0), [props.items])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: any }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        enterHandler();
        return true;
      }

      return false;
    },
  }))

  return (
    <ScrollArea.Autosize mah='25ch'>
      <Stack spacing={0} sx={(theme) => ({
        padding: 3,
        width: '20ch',
        maxWidth: '100%',
        backgroundColor: theme.colors.dark[5],
        border: `1px solid ${theme.colors.dark[6]}`,
        boxShadow: '0px 0px 10px #00000033',
      })}>
        {props.items.length
          ? props.items.map((item, index) => (
            <UnstyledButton
              key={index}
              sx={(theme) => {
                const selected = selectedIndex === index;
                return {
                  padding: '0.25rem 0.4rem 0.25rem 0.4rem',
                  backgroundColor: theme.colors.dark[selected ? 4 : 5],
                  borderRadius: theme.radius.sm,
                  '&:hover': {
                    backgroundColor: theme.colors.dark[4],
                  },
                };
              }}
              onClick={() => selectItem(index)}
              onMouseEnter={() => setSelectedIndex(-1)}
            >
              <Text size='sm'>{item.name}</Text>
            </UnstyledButton>
          ))
          : <Text size='sm' color='dimmed'>No results</Text>
        }
      </Stack>
    </ScrollArea.Autosize>
  )
});


////////////////////////////////////////////////////////////
const MentionSuggestor: Omit<SuggestionOptions<SuggestionType>, 'editor'> = {
  items: async ({ editor, query }) => {
    const storage = editor.storage.pingMention as PingMentionStorage;
    const members: Member[] = storage.members;
    const roles: Role[] = storage.domain.roles;

    // Filter members by name
    query = query.toLowerCase();
    let filteredM = members.filter(x => x.alias.toLowerCase().includes(query));

    // Check if more members need to be requested
    if (filteredM.length <= config.app.member.new_query_threshold && (query.length && storage.has_more_results[query.slice(0, -1)])) {
      // Request new search query
      const newMembers = await listMembers(storage.domain.id, query, storage.session);

      // Merge members lists
      const memberMap: Record<string, Member> = {};
      for (const member of members)
        memberMap[member.id] = member;

      // Add new members to list
      for (const member of newMembers) {
        if (!memberMap[member.id])
          members.push(member);
      }

      // Sort members array
      members.sort((a, b) => (a.alias > b.alias) ? 1 : ((b.alias > a.alias) ? -1 : 0));

      // Refilter and evaluate
      filteredM = members.filter(x => x.alias.toLowerCase().includes(query.toLowerCase()));

      // There are potentially more query results if the number of new members is equal to
      // the query limit (indicating the results are forcefully limited)
      storage.has_more_results[query] = newMembers.length >= config.app.member.query_limit;
    }
    else {
      // Update flag that indicates if there are potentially more results to see
      storage.has_more_results[query] = storage.has_more_results[query.slice(0, -1)];
    }

    // Filter roles
    const filteredR = roles.filter(x => x.name.toLowerCase().startsWith(query));

    // Merge lists
    const filtered = [
      ...filteredM.map(x => ({
        type: 'member',
        id: x.id,
        name: x.alias,
        color: x.color,
      })),
      ...filteredR.map(x => ({
        type: 'role',
        id: x.id,
        name: x.name,
        color: x.color,
      })),
    ] as SuggestionType[];

    return filtered;
  },

  render: () => {
    let component: ReactRenderer<any, typeof MentionList>;
    let popup: Instance<TippyProps>[];

    return {
      onStart: props => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        })

        if (!props.clientRect) {
          return
        }

        popup = tippy('body', {
          getReferenceClientRect: () => props.clientRect ? props.clientRect() || new DOMRect() : new DOMRect(),
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        })
      },

      onUpdate(props) {
        component.updateProps(props)

        if (!props.clientRect) {
          return
        }

        popup[0].setProps({
          getReferenceClientRect: () => props.clientRect ? props.clientRect() || new DOMRect() : new DOMRect(),
        })
      },

      onKeyDown(props) {
        if (props.event.key === 'Escape') {
          popup[0].hide();

          return true;
        }

        return component.ref?.onKeyDown(props);
      },

      onExit() {
        popup[0].destroy();
        component.destroy();
      },
    }
  },
  
  command: ({ editor, range, props }) => {
    // increase range.to by one when the next node is of type "text"
    // and starts with a space character
    const nodeAfter = editor.view.state.selection.$to.nodeAfter
    const overrideSpace = nodeAfter?.text?.includes(' ')

    if (overrideSpace) {
      range.to += 1
    }

    editor
      .chain()
      .focus()
      .insertContentAt(range, [
        {
          type: 'pingMention',
          attrs: {
            id: props.id,
            name: props.name,
            type: props.type,
            color: props.color,
          },
        },
        {
          type: 'text',
          text: ' ',
        },
      ])
      .run()

    window.getSelection()?.collapseToEnd()
  },
};


////////////////////////////////////////////////////////////
export default PingMention.configure({
  suggestion: MentionSuggestor,
  renderLabel: ({ options, node }) => `${options.suggestion.char}${node.attrs.name}`,
});