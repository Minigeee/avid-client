import { MantineTheme, Tuple } from '@mantine/core';

/** Value that depends on theme */
type ThemeValue = ((theme: MantineTheme) => string) | string;

/** Theme object */
export type Theme = {
  /** Color scheme */
  scheme: 'light' | 'dark';
  /** Primary colors */
  primary: Tuple<string, 10>;
  /** Secondary colors */
  secondary: Tuple<string, 10>;
  /** Accent colors */
  accent: Tuple<string, 10>;
  /** Gradient color */
  gradient: [string, string] | ((theme: MantineTheme) => [string, string]);
  /** Dimmed color */
  dimmed: ThemeValue;

  /** Default shade */
  default_shade?: number;

  /** Universal colors */
  colors: {
    /** Neutral highlight */
    neutral_highlight?: ThemeValue;
    /** Secondary color highlight */
    secondary_highlight?: ThemeValue;
    /** Ping highlight */
    ping_highlight?: ThemeValue;

    /** Document color (primary) */
    document: ThemeValue;
    /** Document hover color (primary) */
    document_hover: ThemeValue;
    /** Document text color (primary) */
    document_text: ThemeValue;
    /** Document dimmed color (primary) */
    document_dimmed: ThemeValue;

    /** Page color (primary) */
    page: ThemeValue;
    /** Page border */
    page_border: ThemeValue;
    /** Hover color on a page bg */
    page_hover: ThemeValue;
    /** Text color on page bg */
    page_text: ThemeValue;
    /** Dimmed color on page bg */
    page_dimmed: ThemeValue;

    /** Panel color (primary) */
    panel: ThemeValue;
    /** Panel border */
    panel_border: ThemeValue;
    /** Hover color on a panel bg */
    panel_hover: ThemeValue;
    /** Text color on panel bg */
    panel_text: ThemeValue;
    /** Dimmed color on panel bg */
    panel_dimmed: ThemeValue;
  };

  /** Specific element colors */
  elements: {
    /** Avatar default color */
    avatar: ThemeValue;
    /** Avatar default text color */
    avatar_text: ThemeValue;

    /** Calendar text color */
    calendar_text?: ThemeValue;
    /** Calendar dimmed color */
    calendar_dimmed?: ThemeValue;
    /** Calendar hover color */
    calendar_hover?: ThemeValue;
    /** Calendar active color */
    calendar_active?: ThemeValue;
    /** Calendar border color */
    calendar_border?: ThemeValue;
    /** Calendar today highlight color */
    calendar_today?: ThemeValue;
    /** Calendar today highlight text color */
    calendar_today_text?: ThemeValue;
    /** Calendar today highlight dimmed color */
    calendar_today_dimmed?: ThemeValue;
    /** Calendar today highlight hovered color */
    calendar_today_hover?: ThemeValue;
    /** Calendar time indicator line */
    calendar_time_indicator?: ThemeValue;
    /** Calendar base color that is used to blend with event color */
    calendar_block_event?: ThemeValue;
    /** Calendar block event text color */
    calendar_block_event_text?: ThemeValue;
    /** Calendar block event dimmed color */
    calendar_block_event_dimmed?: ThemeValue;
    /** Calendar block event shadow */
    calendar_block_event_shadow?: ThemeValue;
    /** Calendar month header color */
    calendar_month_header?: ThemeValue;
    /** Calendar month header text color */
    calendar_month_header_text?: ThemeValue;

    /** Color of channels panel */
    channels_panel: ThemeValue;
    /** Color of channels panel borders */
    channels_panel_border: ThemeValue;
    /** Color of channels panel text */
    channels_panel_text: ThemeValue;
    /** Color of channels panel dimmed elements */
    channels_panel_dimmed: ThemeValue;
    /** Color of channels panel hovered elements */
    channels_panel_hover: ThemeValue;
    /** Color of channels panel nested hovered elements */
    channels_panel_double_hover: ThemeValue;
    /** Color of channels panel highlight element */
    channels_panel_highlight: ThemeValue;

    /** Context menu shadow */
    context_menu_shadow?: ThemeValue;

    /** Create domain body color */
    create_domain?: ThemeValue;

    /** Data table body color */
    data_table?: ThemeValue;
    /** Data table text color */
    data_table_text?: ThemeValue;
    /** Data table dimmed color */
    data_table_dimmed?: ThemeValue;
    /** Data table border color */
    data_table_border?: ThemeValue;
    /** Data table hover color */
    data_table_hover?: ThemeValue;
    /** Data table header color */
    data_table_header?: ThemeValue;
    /** Data table header text color */
    data_table_header_text?: ThemeValue;
    /** Data table header dimmed color */
    data_table_header_dimmed?: ThemeValue;
    /** Data table header hover color */
    data_table_header_hover?: ThemeValue;

    /** App drawer body color */
    drawer: ThemeValue;
    /** App drawer text color */
    drawer_text: ThemeValue;
    /** App drawer dimmed color */
    drawer_dimmed: ThemeValue;
    /** App drawer hover color */
    drawer_hover: ThemeValue;
    /** App drawer border color */
    drawer_border: ThemeValue;
    /** App drawer profile banner bg color */
    drawer_banner: ThemeValue;
    /** App drawer close icon color */
    drawer_close_icon: ThemeValue;

    /** Emoji picker dropdown bg color */
    emoji_picker?: ThemeValue;
    /** Emoji picker dropdown border color */
    emoji_picker_border?: ThemeValue;
    /** Emoji picker dropdown icon hover */
    emoji_picker_hover?: ThemeValue;
    /** Emoji picker dropdown icon color */
    emoji_picker_icon?: ThemeValue;
    /** Emoji picker dropdown icon color (active) */
    emoji_picker_icon_active?: ThemeValue;
    /** Emoji picker highlight */
    emoji_picker_highlight?: ThemeValue;

    /** Color of emote button (inactive) */
    emote_button?: ThemeValue;
    /** Color of emote button border (inactive) */
    emote_button_border?: ThemeValue;
    /** Color of emote button text (inactive) */
    emote_button_text?: ThemeValue;
    /** Color of emote button (active) */
    emote_button_active: ThemeValue;
    /** Color of emote button border (active) */
    emote_button_active_border: ThemeValue;
    /** Color of emote button text (active) */
    emote_button_active_text: ThemeValue;

    /** Color of app header */
    header: ThemeValue;
    /** Color of app header text */
    header_text: ThemeValue;
    /** Color of app header dimmed elements */
    header_dimmed: ThemeValue;
    /** Color of app header hovered elements */
    header_hover: ThemeValue;

    /** Kanban column color */
    kanban_column?: ThemeValue;
    /** Kanban header color */
    kanban_header?: ThemeValue;
    /** Kanban header text color */
    kanban_header_text?: ThemeValue;
    /** Kanban header hover color */
    kanban_header_hover?: ThemeValue;
    /** Kanban header icon color */
    kanban_header_icon?: ThemeValue;
    /** Kanban card color */
    kanban_card?: ThemeValue;
    /** Kanban card shadow color */
    kanban_card_shadow?: ThemeValue;
    /** Kanban card text color */
    kanban_card_text?: ThemeValue;
    /** Kanban card dimmed color */
    kanban_card_dimmed?: ThemeValue;

    /** Markdown text code bg */
    md_code: ThemeValue;
    /** Markdown text code text */
    md_code_text: ThemeValue;
    /** Markdown table header */
    md_table_header: ThemeValue;
    /** Markdown table header */
    md_table_border: ThemeValue;
    /** Markdown divider */
    md_divider: ThemeValue;
    /** Markdown member ping bg */
    md_ping_member: ThemeValue;
    /** Markdown member ping text */
    md_ping_member_text: ThemeValue;
    /** Markdown role ping bg */
    md_ping_role: ThemeValue;
    /** Markdown role ping text */
    md_ping_role_text: ThemeValue;

    /** Color of member name */
    member_name: ThemeValue;

    /** Message ping highlight color */
    message_highlight_ping?: ThemeValue;
    /** Message ping highlight color (hovered) */
    message_highlight_ping_hover?: ThemeValue;

    /** Rtc join panel body */
    rtc_join_panel?: ThemeValue;
    /** Rtc join panel text */
    rtc_join_panel_text?: ThemeValue;
    /** Rtc join panel dimmed */
    rtc_join_panel_dimmed?: ThemeValue;
    /** Rtc join panel hover */
    rtc_join_panel_hover?: ThemeValue;
    /** Rtc join panel shadow */
    rtc_join_panel_shadow?: ThemeValue;

    /** Rtc control bar color */
    rtc_bar: ThemeValue;
    /** Rtc control bar icon color */
    rtc_bar_icon: ThemeValue;
    /** Rtc control bar disabled color */
    rtc_bar_disabled: ThemeValue;
    /** Rtc control bar hoover color */
    rtc_bar_hover: ThemeValue;
    /** Rtc control bar active color */
    rtc_bar_active: ThemeValue;

    /** Color of rte body */
    rte?: ThemeValue;
    /** Color of rte header */
    rte_header?: ThemeValue;
    /** Color of rte panels (attachments) */
    rte_panel?: ThemeValue;
    /** Color of rte borders */
    rte_border?: ThemeValue;
    /** Color of rte icons */
    rte_icon?: ThemeValue;
    /** Color of rte icon hover */
    rte_hover?: ThemeValue;
    /** Color of rte icon active */
    rte_active: ThemeValue;
    /** Color of rte dimmed elements */
    rte_dimmed?: ThemeValue;

    /** Color of scroll button */
    scroll_button: ThemeValue;
    /** Color of scroll button hover */
    scroll_button_hover: ThemeValue;
    /** Color of scroll button icon */
    scroll_button_icon: ThemeValue;

    /** Settings modal body */
    settings?: ThemeValue;
    /** Settings modal border */
    settings_border?: ThemeValue;
    /** Settings modal text */
    settings_text?: ThemeValue;
    /** Settings modal dimmed */
    settings_dimmed?: ThemeValue;
    /** Settings modal hover */
    settings_hover?: ThemeValue;
    /** Settings modal panel (used to highlight certain sections) */
    settings_panel?: ThemeValue;
    /** Settings modal panel text */
    settings_panel_text?: ThemeValue;
    /** Settings modal panel dimmed */
    settings_panel_dimmed?: ThemeValue;
    /** Settings modal panel hover */
    settings_panel_hover?: ThemeValue;
    /** Settings modal tabs panel */
    settings_tabs?: ThemeValue;
    /** Settings modal tabs panel text */
    settings_tabs_text?: ThemeValue;
    /** Settings modal tabs panel dimmed */
    settings_tabs_dimmed?: ThemeValue;
    /** Settings modal tabs panel hover */
    settings_tabs_hover?: ThemeValue;
    /** Settings modal tabs panel tab highlight */
    settings_tabs_highlight?: ThemeValue;

    /** Tooltip color */
    tooltip?: ThemeValue;
    /** Tooltip text color */
    tooltip_text?: ThemeValue;

    /** Typing indicator bg color */
    typing_indicator: ThemeValue;
    /** Typing indicator text color */
    typing_indicator_text: ThemeValue;
  };
};
