import { Node, nodeInputRule, nodePasteRule } from '@tiptap/core';

import { Emoji, emojiSearch } from '../Emoji';

import emojiRegex from 'emoji-regex';


const _emojiRegex = emojiRegex();

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
      })
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
});