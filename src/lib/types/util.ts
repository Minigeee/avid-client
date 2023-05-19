
/** Date type */
export type Date = string;

/** Adds id field */
export type WithId<T> = T & {
	/** Object id */
	id: string;
};

/** Omits id field */
export type NoId<T> = Omit<T, 'id'>;

/** Recursively makes all objects partial */
export type DeepPartial<T> = T extends object ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;