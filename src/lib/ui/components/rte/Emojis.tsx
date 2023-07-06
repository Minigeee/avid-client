import { Node } from '@tiptap/core';

import { Emoji, emojiSearch } from '../Emoji';


export const Emojis = Node.create({
  name: 'emojis',

  priority: 1000,

  addAttributes() {
    return {
      'emoji-id': '',
    };
  },

  group: 'inline',
  inline: true,
  selectable: false,

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
      ['data-type']: 'emojis',
    };

    const emoji = attrs['emoji-id'] ? emojiSearch.get(attrs['emoji-id']) : null;

    // TODO : Support more emoji types, currently only native
    return [
      'span',
      finalAttrs, [
        'span', {
          style: 'font-family: "Apple Color Emoji", "Twemoji Mozilla", "Noto Color Emoji", "Android Emoji";',
        },
        emoji?.skins[0].native || 0,
      ],
    ];
  },
});