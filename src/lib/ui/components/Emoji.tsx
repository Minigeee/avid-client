import { CSSProperties, ComponentPropsWithoutRef, RefObject, forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ActionIcon,
  Box,
  CloseButton,
  ColorSwatch,
  Divider,
  Flex,
  Group,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Tooltip,
  createStyles
} from '@mantine/core';
import { useDebouncedState, useDebouncedValue, useIntersection } from '@mantine/hooks';

import {
  IconApple,
  IconBallBasketball,
  IconBulb,
  IconCar,
  IconDog,
  IconFlag,
  IconMathSymbols,
  IconMoodHappy,
  IconSearch,
  TablerIconsProps,
} from '@tabler/icons-react';

import data from '@emoji-mart/data';
import { SearchIndex } from 'emoji-mart';

import { FixedSizeList, areEqual } from './VirtualList';
import type { ListOnScrollProps } from 'react-window';
import { throttle } from 'lodash';


////////////////////////////////////////////////////////////
const useStyles = createStyles((theme) => ({
  list: {
    '&::-webkit-scrollbar': {
      width: 12,
    },
    '&::-webkit-scrollbar-track': {
      backgroundColor: theme.colors.dark[7],
    },
    '&::-webkit-scrollbar-thumb': {
      minHeight: '3rem',
      backgroundColor: theme.colors.dark[2],
      borderRadius: 10,
      border: `2px solid ${theme.colors.dark[7]}`,
    },
  },
}));


////////////////////////////////////////////////////////////
export type EmojiType = typeof data.emojis[string];


////////////////////////////////////////////////////////////
type CategoryIconProps = TablerIconsProps & { category: string; };

////////////////////////////////////////////////////////////
function CategoryIcon({ category, ...props }: CategoryIconProps) {
  if (category === 'people')
    return <IconMoodHappy {...props} />;
  else if (category === 'nature')
    return <IconDog {...props} />;
  else if (category === 'foods')
    return <IconApple {...props} />;
  else if (category === 'activity')
    return <IconBallBasketball {...props} />;
  else if (category === 'places')
    return <IconCar {...props} />;
  else if (category === 'objects')
    return <IconBulb {...props} />;
  else if (category === 'symbols')
    return <IconMathSymbols {...props} />;
  else if (category === 'flags')
    return <IconFlag {...props} />;
  else
    return null;
}

////////////////////////////////////////////////////////////
function getCategoryLabel(category: string) {
  if (category === 'people')
    return 'Faces & People';
  else if (category === 'nature')
    return 'Animals & Nature';
  else if (category === 'foods')
    return 'Food & Drinks';
  else if (category === 'activity')
    return 'Activities';
  else if (category === 'places')
    return 'Travel & Places';
  else if (category === 'objects')
    return 'Objects';
  else if (category === 'symbols')
    return 'Symbols';
  else if (category === 'flags')
    return 'Flags';
  else
    return '';
}


////////////////////////////////////////////////////////////
let _nativeToId = null as Record<string, string> | null;

let Pool: any[] | null = null;
export const emojiSearch = {
  SHORTCODES_REGEX: /^(?:\:([^\:]+)\:)(?:\:skin-tone-(\d)\:)?$/,

  get: (emojiId: string) => {
    // Construct native to id if needed
    if (!_nativeToId) {
      _nativeToId = {};

      for (const emoji of Object.values(data.emojis)) {
        for (const skin of emoji.skins) {
          if (skin.native)
            _nativeToId[skin.native] = emoji.id;
        }
      }
    }

    return (
      data.emojis[emojiId] ||
      data.emojis[data.aliases[emojiId]] ||
      data.emojis[_nativeToId[emojiId]]
    )
  },

  reset: () => {
    Pool = null
  },

  search: (value: any, { maxResults, caller }: any = {}) => {
    if (!value || !value.trim().length) return null
    maxResults || (maxResults = 90)

    const values = value
      .toLowerCase()
      .replace(/(\w)-/, '$1 ')
      .split(/[\s|,]+/)
      .filter((word: string, i: number, words: string[]) => {
        return word.trim() && words.indexOf(word) == i
      });

    if (!values.length) return

    let pool = Pool || (Pool = Object.values(data.emojis))
    let results: EmojiType[] = [], scores: Record<string, number>;

    for (const value of values) {
      if (!pool.length) break

      results = []
      scores = {}

      for (const emoji of pool) {
        if (!emoji.search) continue
        const score = emoji.search.indexOf(`,${value}`)
        if (score == -1) continue

        results.push(emoji)
        scores[emoji.id] || (scores[emoji.id] = 0)
        scores[emoji.id] += emoji.id == value ? 0 : score + 1
      }

      pool = results
    }

    if (results.length < 2) {
      return results
    }

    results.sort((a: any, b: any) => {
      const aScore = scores[a.id]
      const bScore = scores[b.id]

      if (aScore == bScore) {
        return a.id.localeCompare(b.id)
      }

      return aScore - bScore
    })

    if (results.length > maxResults) {
      results = results.slice(0, maxResults)
    }

    return results
  },
};


////////////////////////////////////////////////////////////
type EmojiProps = {
  fallback?: string;
  id: string;
  native?: string;
  shortcodes?: string;
  size?: string | number;
  set?: string;
  skin?: number;
  emoji?: EmojiType;

  spritesheet?: string;
  getImageURL?: (set: string, id: string) => string;
  getSpritesheetURL?: (set: string) => string;
};

////////////////////////////////////////////////////////////
// From emoji-mart
export function Emoji(props: EmojiProps) {
  let { id, skin, emoji } = props;
  const set = props.set || 'native';

  if (props.shortcodes) {
    const matches = props.shortcodes.match(emojiSearch.SHORTCODES_REGEX)

    if (matches) {
      id = matches[1]

      if (matches[2]) {
        skin = parseInt(matches[2])
      }
    }
  }

  emoji || (emoji = emojiSearch.get(id || props.native || ''))
  if (!emoji) return <>{props.fallback || null}</>;

  const emojiSkin = skin !== undefined && skin <= emoji.skins.length ? emoji.skins[skin - 1] : emoji.skins[0];

  const imageSrc =
    emojiSkin.src ||
    (set != 'native' && !props.spritesheet
      ? typeof props.getImageURL === 'function'
        ? props.getImageURL(set, emojiSkin.unified)
        : `https://cdn.jsdelivr.net/npm/emoji-datasource-${set}@14.0.0/img/${set}/64/${emojiSkin.unified}.png`
      : undefined)

  const spritesheetSrc =
    typeof props.getSpritesheetURL === 'function'
      ? props.getSpritesheetURL(set)
      : `https://cdn.jsdelivr.net/npm/emoji-datasource-${set}@14.0.0/img/${set}/sheets-256/64.png`

  return (
    <span data-type='emojis' emoji-id={id} data-emoji-set={set}>
      {imageSrc ? (
        <img
          style={{
            maxWidth: props.size || '1em',
            maxHeight: props.size || '1em',
            display: 'inline-block',
          }}
          alt={emojiSkin.native || emojiSkin.shortcodes}
          src={imageSrc}
        />
      ) : set == 'native' ? (
        <span
          style={{
            fontSize: props.size,
            fontFamily: '"Apple Color Emoji", "Twemoji Mozilla", "Noto Color Emoji", "Android Emoji"',
          }}
        >
          {emojiSkin.native}
        </span>
      ) : (
        <span
          style={{
            display: 'block',
            width: props.size,
            height: props.size,
            backgroundImage: `url(${spritesheetSrc})`,
            backgroundSize: `${100 * data.sheet.cols}% ${100 * data.sheet.rows
              }%`,
            backgroundPosition: `${(100 / (data.sheet.cols - 1)) * (emojiSkin.x || 0)
              }% ${(100 / (data.sheet.rows - 1)) * (emojiSkin.y || 0)}%`,
          }}
        ></span>
      )}
    </span>
  )
}

export const MemoEmoji = memo(Emoji);


////////////////////////////////////////////////////////////
type EmojiButtonProps = {
  id: string;
  skin?: number;
  size: number;
  setHovered?: (id: string) => void;
  onClick?: () => void;
};

////////////////////////////////////////////////////////////
function EmojiButton(props: EmojiButtonProps) {
  return (
    <ActionIcon size={props.size + 8} onMouseEnter={() => props.setHovered?.(props.id)} onClick={props.onClick}>
      <Emoji id={props.id} skin={props.skin} size={props.size} />
    </ActionIcon>
  );
}



////////////////////////////////////////////////////////////
const SKIN_VALUES = [
  { value: '0', label: 'Default', color: '#ffc93a' },
  { value: '1', label: 'Light', color: '#ffdab7' },
  { value: '2', label: 'Medium-Light', color: '#e7b98f' },
  { value: '3', label: 'Medium', color: '#c88c61' },
  { value: '4', label: 'Medium-Dark', color: '#a46134' },
  { value: '5', label: 'Dark', color: '#5d4437' },
];

////////////////////////////////////////////////////////////
const SkinSelectItem = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'> & { label: string; color: string }>(
  ({ label, color, ...others }, ref) => (
    <div ref={ref} {...others} title={label}>
      <ColorSwatch color={color} size='1.2rem' />
    </div>
  )
);
SkinSelectItem.displayName = 'SkinSelectItem';


////////////////////////////////////////////////////////////
// Row component function
const ItemWrapper = memo(({ data, index, style }: { data: ((style: CSSProperties) => JSX.Element)[], index: number, style: CSSProperties }) => {
  return data[index](style);
}, areEqual);
ItemWrapper.displayName = 'EmojiItemWrapper';


////////////////////////////////////////////////////////////
type EmojiPickerPageProps = {
  containerRef: RefObject<HTMLDivElement>;

  buttons: JSX.Element[];
  emojiSize: number;
  emojisPerRow: number;
  gutter: number;
};

////////////////////////////////////////////////////////////
function EmojiPickerPage(props: EmojiPickerPageProps) {
  const numRows = Math.ceil(props.buttons.length / props.emojisPerRow);

  const { ref: pageRef, entry } = useIntersection({ root: props.containerRef.current, threshold: 0 });

  const [isIntersecting, setIsIntersecting] = useState<boolean>(false);
  const [debounced] = useDebouncedValue(isIntersecting, 100);
  useEffect(() => {
    if (!entry) return;
    setIsIntersecting(entry.isIntersecting);
  }, [entry?.isIntersecting || false]);

  // Filler element
  const filler = useMemo(() => (
    <div
      ref={pageRef}
      style={{
        height: numRows * (props.emojiSize + props.gutter + 8),
        width: props.emojisPerRow * (props.emojiSize + props.gutter + 8) - props.gutter,
      }}
    />
  ), []);

  // Content
  const page = useMemo(() => {
    return (
      <SimpleGrid
        ref={pageRef}
        spacing={props.gutter}
        verticalSpacing={props.gutter}
        mb={props.gutter}
        cols={props.emojisPerRow}
      >
        {props.buttons}
      </SimpleGrid>
    );
  }, [props.buttons]);

  
  return debounced ? page : filler;
}


////////////////////////////////////////////////////////////
type EmojiPickerScrollAreaProps = {
  containerRef: RefObject<HTMLDivElement>;
  scrollInfo: {
    categories: Record<string, JSX.Element[]>;
    positions: Record<string, number>;
    hideAfter: Record<string, number>;
    titlePos: number[];
  };
  searchPages: JSX.Element[];
  activeCategoryIdx: number;
  setActiveCategoryIdx: (value: number) => void;
};

////////////////////////////////////////////////////////////
function EmojiPickerScrollArea({ containerRef, scrollInfo, activeCategoryIdx, ...props }: EmojiPickerScrollAreaProps) {
  const [scrollPos, setScrollPos] = useState<number>(0);

  // Called on scroll change
  const onScrollChange = useCallback(
    throttle(({ y }: { y: number }) => {
      if (props.searchPages.length > 0) return;

      // Get new index
      let idx = activeCategoryIdx;
      if (y > scrollInfo.titlePos[idx]) {
        while (idx < scrollInfo.titlePos.length && y > scrollInfo.titlePos[idx])
          ++idx;
        --idx;
      }
      else {
        while (idx > 0 && y < scrollInfo.titlePos[idx])
          --idx;
      }

      // Update category index if changed
      if (idx !== activeCategoryIdx)
        props.setActiveCategoryIdx(idx);

      setScrollPos(y);
    }, 100, { leading: false }),
    [props.searchPages.length, activeCategoryIdx]
  );

  return (
    <ScrollArea viewportRef={containerRef} h={350} offsetScrollbars onScrollPositionChange={onScrollChange}>
      {props.searchPages.length > 0 && (
        <>
          <Text
            size='md'
            weight={600}
            sx={(theme) => ({
              position: 'sticky',
              height: 32,
              top: 0,
              zIndex: 1,
              backgroundColor: `${theme.colors.dark[7]}D0`,
              backdropFilter: 'blur(6px)',
            })}
          >
            Search Results
          </Text>
          {props.searchPages}
        </>
      )}
      {props.searchPages.length === 0 && Object.entries(scrollInfo.categories).map(([category, pages]) => (
        <>
          <Text
            size='md'
            weight={600}
            sx={(theme) => ({
              visibility: scrollPos >= (scrollInfo.hideAfter[category] || 1000000) ? 'hidden' : undefined,
              position: 'sticky',
              height: 32,
              top: 0,
              zIndex: 1,
              backgroundColor: `${theme.colors.dark[7]}D0`,
              backdropFilter: 'blur(6px)',
            })}
          >
            {getCategoryLabel(category)}
          </Text>
          {pages}
        </>
      ))}
    </ScrollArea>
  );
}


////////////////////////////////////////////////////////////
type EmojiPickerProps = {
  iconSize?: number;
  iconsPerRow?: number;
  emojiSize?: number;

  onSelect?: (emoji: EmojiType) => void;
};

////////////////////////////////////////////////////////////
export function EmojiPicker(props: EmojiPickerProps) {
  const iconSize = props.iconSize || 24;
  const iconsPerRow = props.iconsPerRow || 7;
  const rowsPerPage = 20;
  const emojiSize = props.emojiSize || 24;
  
  // Ref for scoll list
  const listRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState<string>('');
  const [debouncedSearch] = useDebouncedValue(search, 50, { leading: true });
  const [skin, setSkin] = useState<string>('0');
  const [activeCategoryIdx, setActiveCategoryIdx] = useState<number>(0);
  const [hovered, setHovered] = useState<string | null>(null);

  // Hovered emoji object
  const hoveredEmoji = useMemo(() => {
    if (!hovered) return null;
    return emojiSearch.get(hovered);
  }, [hovered]);

  // Filtered search results
  const searchPages = useMemo(() => {
    // Return all if no search
    if (debouncedSearch.length === 0) {
      return [];
    }

    // New search query
    const query = debouncedSearch.toLocaleLowerCase().replace(/\s+/g, '_');
    const filtered = Object.values(data.emojis).filter((emoji) =>
      emoji.id.indexOf(query) >= 0 || emoji.keywords.findIndex(kw => kw.indexOf(query) >= 0) >= 0 || emoji.name.toLocaleLowerCase().replace(/\s+/g, '_').indexOf(query) >= 0
    ).map(x => x.id);

    if (filtered.length === 0)
      return [];

    // Calculate num pages
    const skinNum = parseInt(skin) + 1;
    const iconsPerPage = iconsPerRow * rowsPerPage;
    const numPages = Math.ceil(filtered.length / iconsPerPage);

    const pages: JSX.Element[] = [];
    
    // WIP : Finish emoji picker
    for (let i = 0; i < numPages; ++i) {
      // Emoji buttons
      const buttons = filtered.slice(i * iconsPerPage, (i + 1) * iconsPerPage).map((id) => (
        <EmojiButton
          key={id}
          id={id}
          skin={skinNum}
          size={emojiSize}
          setHovered={setHovered}
          onClick={() => props.onSelect?.(emojiSearch.get(id))}
        />
      ));

      // Add page
      pages.push(
        <EmojiPickerPage
          containerRef={listRef}
          buttons={buttons}
          emojiSize={emojiSize}
          emojisPerRow={iconsPerRow}
          gutter={8}
        />
      );
    }
    
    return pages;
  }, [debouncedSearch, skin]);

  // Scroll info
  const scrollInfo = useMemo(() => {
    const skinNum = parseInt(skin) + 1;
    const categories: Record<string, JSX.Element[]> = {};
    const positions: Record<string, number> = {};
    const hideAfter: Record<string, number> = {};
    const titlePos: number[] = [];

    for (let i = 0; i < data.categories.length; ++i) {
      const category = data.categories[i];
      const pages = categories[category.id] = [] as JSX.Element[];

      // Calculate num pages
      const iconsPerPage = iconsPerRow * rowsPerPage;
      const numPages = Math.ceil(category.emojis.length / iconsPerPage);

      // Calculate position
      const prevCategory = i === 0 ? null : data.categories[i - 1];
      const pos = prevCategory ? hideAfter[prevCategory.id] : 0;
      const size = Math.ceil(category.emojis.length / iconsPerRow) * (emojiSize + 8 + 8) + (32);
      hideAfter[category.id] = pos + size;
      positions[category.id] = pos;
      titlePos.push(pos);

      for (let i = 0; i < numPages; ++i) {
        // Emoji buttons
        const buttons = category.emojis.slice(i * iconsPerPage, (i + 1) * iconsPerPage).map((id) => (
          <EmojiButton
            key={id}
            id={id}
            skin={skinNum}
            size={emojiSize}
            setHovered={setHovered}
            onClick={() => props.onSelect?.(emojiSearch.get(id))}
          />
        ));

        // Add page
        pages.push(
          <EmojiPickerPage
            containerRef={listRef}
            buttons={buttons}
            emojiSize={emojiSize}
            emojisPerRow={iconsPerRow}
            gutter={8}
          />
        );
      }
    }

    return { categories, positions, hideAfter, titlePos };
  }, [skin]);


  return (
    <Stack spacing='sm' w='fit-content'>
      <Box sx={(theme) => ({
        borderBottom: `1px solid ${theme.colors.dark[5]}`,
      })}>
        <Group spacing={0}>
          {data.categories.map((category, idx) => (
            <Tooltip
              key={category.id}
              label={getCategoryLabel(category.id)}
              withArrow
            >
              <ActionIcon
                size={1.5 * iconSize}
                sx={(theme) => ({
                  color: idx === activeCategoryIdx ? theme.colors.dark[0] : theme.colors.dark[1],
                  transition: 'color, 0.1s',
                })}
                onClick={() => {
                  if (!listRef.current || searchPages.length > 0) return;

                  setActiveCategoryIdx(idx);
                  listRef.current?.scrollTo({ top: scrollInfo.positions[category.id] });
                }}
              >
                <CategoryIcon category={category.id} size={iconSize} />
              </ActionIcon>
            </Tooltip>
          ))}
        </Group>

        <Box
          mt={4}
          w={1.5 * iconSize - 4}
          h={3}
          sx={(theme) => ({
            position: 'relative',
            left: 2 + 1.5 * iconSize * activeCategoryIdx,
            background: theme.fn.linearGradient(50, theme.colors.violet[5], theme.colors.pink[5]),
            borderTopRightRadius: 3,
            borderTopLeftRadius: 3,
            transition: 'left, 0.1s',
          })}
        />
      </Box>

      <Group noWrap spacing='xs'>
        <TextInput
          placeholder='Search'
          icon={<IconSearch size={18} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          rightSection={search.length > 0 ? (
            <CloseButton
              onClick={() => setSearch('')}
            />
          ) : undefined}
          autoFocus
          sx={{ flexGrow: 1 }}
        />
        <Select
          data={SKIN_VALUES}
          itemComponent={SkinSelectItem}
          icon={<ColorSwatch color={SKIN_VALUES[parseInt(skin)].color} size='1rem' />}
          value={skin}
          onChange={(value) => {
            if (value)
              setSkin(value);
          }}
          styles={{
            input: {
              width: '1rem',
              padding: '1px 1.25rem',
            },
          }}
        />
      </Group>

      <EmojiPickerScrollArea
        containerRef={listRef}
        scrollInfo={scrollInfo}
        searchPages={searchPages}
        activeCategoryIdx={activeCategoryIdx}
        setActiveCategoryIdx={setActiveCategoryIdx}
      />

      <Divider />

      <Group h='3rem'>
        {hovered && (
          <>
            <Emoji id={hovered} skin={parseInt(skin) + 1} size='2rem' />

            <Stack spacing={0}>
              <Text size='sm' weight={600}>{hoveredEmoji?.name}</Text>
              <Text size='xs' color='dimmed'>:{hovered}:</Text>
            </Stack>
          </>
        )}
        {!hovered && (
          <>
            <Emoji id='grinning' skin={parseInt(skin) + 1} size='2rem' />
            <Text size='md' weight={600} color='dimmed'>Pick an emoji...</Text>
          </>
        )}
      </Group>
    </Stack>
  );
}
