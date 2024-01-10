
/** Wiki doc type */
export type Wiki = {
    /** Id of the doc */
    id: string;
    /** Content of the doc */
    content: string;
    /** Optional draft (not published saves) */
    draft?: string | null;
};