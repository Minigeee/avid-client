import { forwardRef, useEffect, useState, useImperativeHandle, useMemo, PropsWithChildren, useRef } from 'react';

import { Node, nodePasteRule } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';

import {
  Divider,
  Group,
  ScrollArea,
  Stack,
  Sx,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useElementSize } from '@mantine/hooks';

import { Emoji } from '../Emoji';
import { EmojiType, emojiSearch } from '@/lib/utility/emoji';

import data from '@emoji-mart/data';
import emojiRegex from 'emoji-regex';
import tippy, { Instance, Props as TippyProps } from 'tippy.js';


const _emojiRegex = emojiRegex();

/** Emoji ids */
const _data = Object.keys(data.emojis);

/** Max number of rows shown at once */
const MAX_ROWS = 30;


////////////////////////////////////////////////////////////
const EmojiSuggestionList = forwardRef((props: SuggestionProps<EmojiType>, ref) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const { ref: itemRef, height: itemHeight } = useElementSize();
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const selectItem = (index: number) => {
    const item = props.items[index]

    if (item) {
      props.command(item);
    }
  }

  const fixScroll = (idx: number) => {
    if (viewportRef.current) {
      if (viewportRef.current.scrollTop + viewportRef.current.clientHeight < (idx + 1) * itemHeight)
        viewportRef.current.scrollTo({ top: (idx + 1) * itemHeight - viewportRef.current.clientHeight + 4 });
      else if (viewportRef.current.scrollTop > idx * itemHeight)
        viewportRef.current.scrollTo({ top: idx * itemHeight });
    }
  };

  const upHandler = () => {
    const idx = (selectedIndex + props.items.length - (selectedIndex < 0 ? 0 : 1)) % props.items.length;
    setSelectedIndex(idx);
    fixScroll(idx);
  }

  const downHandler = () => {
    const idx = (selectedIndex + 1) % props.items.length;
    setSelectedIndex(idx);
    fixScroll(idx);
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
  }));


  return (
    <ScrollArea.Autosize
      viewportRef={viewportRef}
      mah={200}
      sx={(theme) => ({
        maxWidth: '100%',
        backgroundColor: theme.colors.dark[5],
        border: `1px solid ${theme.colors.dark[6]}`,
        boxShadow: '0px 0px 16px #00000033',
      })}
    >
      <Stack spacing={0} p={4}>
        {props.items.length
          ? (
            <>
              {props.items.map((emoji, i) => (
                <UnstyledButton
                  key={emoji.id}
                  ref={i === 0 ? itemRef : undefined}
                  sx={(theme) => ({
                    backgroundColor: theme.colors.dark[selectedIndex === i ? 4 : 5],
                    borderRadius: theme.radius.sm,
                    '&:hover': {
                      backgroundColor: theme.colors.dark[4],
                    },
                  })}
                  onClick={() => selectItem(i)}
                  onMouseEnter={() => setSelectedIndex(-1)}
                >
                  <Group noWrap spacing={8} m='0.25rem 0.4rem'>
                    <Emoji id={emoji.id} size='1rem' />
                    <Text size='sm' weight='600'>:{emoji.id}:</Text>
                  </Group>
                </UnstyledButton>
              ))}
              {props.items.length >= MAX_ROWS && (
                <Text m='0.25rem' size='xs' color='dimmed'>Continue typing to view more...</Text>
              )}
            </>
          ) : <Text size='sm' color='dimmed'>No results</Text>
        }
      </Stack>
    </ScrollArea.Autosize>
  )
});
EmojiSuggestionList.displayName = 'EmojiSuggestionList';


// Cache of search results
let _searchCache: Record<string, string[]> = {};

////////////////////////////////////////////////////////////
const EmojiSuggestor: Omit<SuggestionOptions<EmojiType>, 'editor'> = {
  char: ':',

  items: async ({ editor, query }) => {
    query = query.toLocaleLowerCase();

    // Check if a prev query exists
    const prev = query.length > 1 ? _searchCache[query.slice(0, -1)] : undefined;
    // Get search results
    const results = query.length > 0 ? _searchCache[query] || (prev || _data).filter(x => x.includes(query)) : _data;

    // Save results
    _searchCache[query] = results;

    return results.slice(0, MAX_ROWS).map(x => emojiSearch.get(x));
  },

  render: () => {
    let component: ReactRenderer<any, typeof EmojiSuggestionList>;
    let popup: Instance<TippyProps>[];

    return {
      onStart: props => {
        // Reset cache
        _searchCache = {};

        component = new ReactRenderer(EmojiSuggestionList, {
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
          type: 'emojis',
          attrs: {
            'emoji-id': props.id,
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
export const Emojis = Node.create({
  name: 'emojis',

  priority: 1000,

  addAttributes() {
    return {
      'emoji-id': '',
      'data-emoji-set': {
        default: 'native'
      },
    };
  },

  addOptions() {
    return {
      suggestion: EmojiSuggestor,
    };
  },

  group: 'inline',
  inline: true,
  selectable: false,

  addPasteRules() {
    return [
      nodePasteRule({
        find: _emojiRegex,
        type: this.type,
        getAttributes: (match) => {
          const emoji = emojiSearch.get(match[0]);
          return { 'emoji-id': emoji?.id || '' };
        },
      }),
      nodePasteRule({
        find: /:(\w+):/g,
        type: this.type,
        getAttributes: (match) => {
          const emoji = emojiSearch.get(match[1]);
          return emoji ? { 'emoji-id': match[1] } : null;
        },
      }),
    ];
  },

  parseHTML() {
    return [
      {
        tag: `span[data-type="${this.name}"]`,
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const { attrs } = node;
    
    // Construct attrs
    const finalAttrs: any = {
      ...HTMLAttributes,
      class: 'emoji',
      ['data-type']: 'emojis',
    };

    const emoji = attrs['emoji-id'] ? emojiSearch.get(attrs['emoji-id']) : null;

    // TODO : Support more emoji types, currently only native
    return [
      'span',
      finalAttrs,
      emoji?.skins[0].native || 0,
    ];
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
});