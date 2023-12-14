declare module '@emoji-mart/data' {
  const data: {
    categories: {
      id: string;
      emojis: string[];
    }[];
    emojis: Record<
      string,
      {
        id: string;
        name: string;
        emoticons?: string[];
        keywords: string[];
        skins: {
          unified: string;
          native: string;
          src?: string;
          shortcodes?: string;
          x?: number;
          y?: number;
        }[];
        version: number;
      }
    >;
    aliases: Record<string, string>;
    natives: Record<string, string>;
    sheet: {
      rows: number;
      cols: number;
    };
  };
  export = data;
}
