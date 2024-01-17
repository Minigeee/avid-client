import { Theme } from './types';

const theme = {
  scheme: 'light',

  primary: [
    '#fafafb',
    '#f1f2f4',
    '#e7e8ec',
    '#dcdde3',
    '#c3c4ce',
    '#b2b4c0',
    '#9ea1b0',
    '#63677a',
    '#494b5a',
    '#25272e',
  ],
  secondary: [
    '#EDF2FF',
    '#DBE4FF',
    '#BAC8FF',
    '#91A7FF',
    '#748FFC',
    '#5C7CFA',
    '#4C6EF5',
    '#4263EB',
    '#3B5BDB',
    '#364FC7',
  ],
  accent: [
    '#EDF2FF',
    '#DBE4FF',
    '#BAC8FF',
    '#91A7FF',
    '#748FFC',
    '#5C7CFA',
    '#4C6EF5',
    '#4263EB',
    '#3B5BDB',
    '#364FC7',
  ],
  gradient: (theme) => [theme.colors.violet[4], theme.colors.pink[4]],
  dimmed: (theme) => theme.colors.primary[4],

  colors: {
    document: (theme) => theme.colors.primary[2],
    document_hover: (theme) => theme.colors.primary[3],
    document_text: (theme) => theme.colors.primary[8],
    document_dimmed: (theme) => theme.colors.primary[5],

    page: (theme) => theme.colors.primary[0],
    page_border: (theme) => theme.colors.primary[2],
    page_hover: (theme) => theme.colors.primary[1],
    page_text: (theme) => theme.colors.primary[9],
    page_dimmed: (theme) => theme.colors.primary[5],

    panel: (theme) => theme.colors.primary[1],
    panel_border: (theme) => theme.colors.primary[3],
    panel_hover: (theme) => theme.colors.primary[2],
    panel_text: (theme) => theme.colors.primary[8],
    panel_dimmed: (theme) => theme.colors.primary[6],
  },

  elements: {
    avatar: (theme) => theme.colors.gray[5],
    avatar_text: (theme) => theme.colors.gray[0],

    drawer: (theme) => theme.colors.primary[1],
    drawer_text: (theme) => theme.colors.primary[8],
    drawer_dimmed: (theme) => theme.colors.gray[6],
    drawer_hover: (theme) => theme.colors.primary[2],
    drawer_border: (theme) => theme.colors.primary[3],
    profile_banner: (theme) => theme.colors.primary[5],
    drawer_close_icon: (theme) => theme.colors.gray[6],

    header: (theme) => theme.colors.primary[9],
    header_text: (theme) => theme.colors.primary[0],
    header_dimmed: (theme) => theme.colors.primary[4],
    header_hover: (theme) => `${theme.colors.primary[0]}10`,

    channels_panel: (theme) => theme.colors.primary[2],
    channels_panel_border: (theme) => `${theme.colors.primary[4]}80`,
    channels_panel_text: (theme) => theme.colors.primary[8],
    channels_panel_dimmed: (theme) => `${theme.colors.primary[6]}D0`,
    channels_panel_hover: (theme) => theme.colors.primary[3],
    channels_panel_double_hover: (theme) => `${theme.colors.primary[4]}80`,
    channels_panel_highlight: (theme) =>
      theme.fn.linearGradient(0, theme.colors.violet[4], theme.colors.pink[4]),

    emoji_picker_highlight: (theme) =>
      theme.fn.linearGradient(50, theme.colors.pink[4], theme.colors.violet[4]),

    emote_button_active: (theme) =>
      theme.fn.linearGradient(0, theme.colors.violet[3], theme.colors.grape[3]),
    emote_button_active_border: (theme) => theme.colors.primary[3],
    emote_button_active_text: (theme) => theme.colors.primary[0],

    md_code: 'rgb(250, 250, 250)',
    md_code_border: (theme) => theme.colors.primary[3],
    md_code_text: (theme) => theme.colors.gray[8],
    md_inline_code: (theme) => theme.colors.primary[2],
    md_inline_code_text: (theme) => theme.colors.gray[8],
    md_table_header: (theme) => theme.colors.primary[1],
    md_table_border: (theme) => theme.colors.primary[2],
    md_divider: (theme) => theme.colors.gray[4],
    md_ping_member: (theme) => `${theme.colors.secondary[2]}80`,
    md_ping_member_text: (theme) => theme.colors.gray[8],
    md_ping_role: (theme) => `${theme.colors.secondary[1]}80`,
    md_ping_role_text: (theme) => theme.colors.gray[8],

    member_name: (theme) => theme.colors.gray[7],

    message_highlight_ping: (theme) => `${theme.colors.grape[3]}20`,
    message_highlight_ping_hover: (theme) => `${theme.colors.grape[3]}30`,

    scroll_button: (theme) => theme.colors.gray[6],
    scroll_button_hover: (theme) => theme.colors.gray[7],
    scroll_button_icon: (theme) => theme.white,

    rtc_bar: (theme) => theme.colors.primary[8],
    rtc_bar_icon: (theme) => theme.colors.primary[3],
    rtc_bar_disabled: (theme) => theme.colors.primary[6],
    rtc_bar_hover: (theme) => `${theme.colors.primary[7]}80`,
    rtc_bar_active: (theme) => theme.colors.primary[7],

    rte_active: (theme) => theme.colors.primary[3],

    typing_indicator: (theme) => `${theme.colors.gray[8]}c0`,
    typing_indicator_text: (theme) => theme.white,
  },
} as Theme;

export default theme;
