
import data from '@emoji-mart/data';
import emojiRegex from 'emoji-regex';


/** Object type used to represent an emoji */
export type EmojiType = typeof data.emojis[string];

/** Regex used to detect native emojis */
const _emojiRegex = emojiRegex();


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


/** Renders all native emojis in a string so that they are displayed with the right font */
export function renderNativeEmojis(str: string) {
	return str.replaceAll(_emojiRegex, (match) => {
		const emoji = emojiSearch.get(match);
		return emoji ? `<span class="emoji" data-type="emojis" emoji-id="${emoji.id}" data-emoji-set="native">${match}</span>` : match;
	})
}