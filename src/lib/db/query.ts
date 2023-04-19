import axios from 'axios';

import config from '@/config';
import assert from 'assert';


/** Use to hold query default token */
export const queryDefault = {
	token: '',
};


/**
 * Make a query to SurrealDB
 * 
 * @param sql The query string
 * @param complete Determines if all statement results should be returned
 * @returns A promise for the query results
 */
export async function query<T, Ret = T>(sql: string, complete: boolean = false): Promise<Ret> {
	const is_server = typeof window === 'undefined';
	if (is_server) {
		assert(process.env.SURREAL_USERNAME);
		assert(process.env.SURREAL_PASSWORD);
	}

	const result = await axios.post(config.db.url, sql.trim(), {
		// Use username password auth if on server
		auth: is_server && process.env.SURREAL_USERNAME && process.env.SURREAL_PASSWORD ? {
			username: process.env.SURREAL_USERNAME,
			password: process.env.SURREAL_PASSWORD,
		} : undefined,

		headers: {
			// Use bearer token if on client
			Authorization: !is_server ? `Bearer ${queryDefault.token}` : undefined,
			Accept: 'application/json',
			NS: config.db.namespace,
			DB: config.db.database,
		},
	});

	// TODO : Error handling

	return complete ? result.data.map((x: any) => x.result) : result.data.at(-1).result;
}


////////////////////////////////////////////////////////////
type _NestedPaths<T> = T extends string | number | boolean | Date | RegExp | Buffer | Uint8Array | ((...args: any[]) => any) | {
	_bsontype: string;
} ? never :
	T extends ReadonlyArray<infer A> ? ([] | _NestedPaths<A>) :
	T extends Map<string, any> ? [string] :
	T extends object ? {
		[K in keyof Required<T>]:
		T[K] extends T ? [K] : T extends T[K] ? [K] :
		[K, ...([] | _NestedPaths<T[K]>)];
	}[keyof T] : never;

type Join<T extends unknown[], D extends string> =
	T extends [] ? '' : T extends [string | number] ? `${T[0]}` : T extends [string | number, ...infer R] ? `${T[0]}${D}${Join<R, D>}` : string;

/** All selectable fields up to a certain recursion level */
export type Selectables<T> = Join<_NestedPaths<T>, '.'>;


/** Operators */
export type SqlOp = '&&' | '||' | '??' | '?:' | '=' | '!=' | '==' | '?=' | '*=' | '~'
	| '!~' | '*~' | '<' | '<=' | '>' | '>=' | '+' | '-' | '*' | '/'
	| '**' | 'IN' | 'NOT IN' | 'CONTAINS' | 'CONTAINSNOT' | 'CONTAINSALL' | 'CONTAINSANY' | 'CONTAINSNONE'
	| 'INSIDE' | 'NOTINSIDE' | 'ALLINSIDE' | 'ANYINSIDE' | 'NONEINSIDE' | 'OUTSIDE' | 'INTERSECTS';

/** Return modes */
export type SqlReturn = 'NONE' | 'BEFORE' | 'DIFF';

/** Relate statement options */
export type SqlRelateOptions<T extends object> = {
	/** Extra content that should be stored in relate edge */
	content?: Partial<T>;
	/** Return mode (by default NONE) */
	return?: SqlReturn | Selectables<T>[];
};

/** Select statement options */
export type SqlSelectOptions = {
	/** Record to select from */
	from: string;
	/** Select condition */
	where?: string;
};

/** Update statement options */
export type SqlUpdateOptions<T extends object> = {
	/** Update condition */
	where?: string;
	/** Return mode */
	return?: SqlReturn | Selectables<T>[];
	/** Data that should be incremented or decremented (or array push or pull) (nested fields can't be used in `content` or `set` if `set` is defined) */
	set?: { [K in keyof T]?: T[K] | ['=' | '+=' | '-=', T[K] | string] };
	/** Whether update should merge or replace data (merge by default) */
	merge?: boolean;
};

type SqlType = number | string;

function _v(x: unknown) {
	return typeof x === 'string' && x[0] !== '$' ? `"${x}"` : x;
}

function _json(x: any) {
	let json = JSON.stringify(x);
	json.replace(/\\"/g, "\uFFFF");  // U+ FFFF
	json = json.replace(/"([^"]+)":/g, '$1:');
	json = json.replace(/:"(\$[^"]+)"/g, ':$1').replace(/\uFFFF/g, '\\\"');
	return json;
}

/** SQL commands in function form for ease of use and future proofing */
export const sql = {
	/** Join a list of expressions with "and" */
	and: (exprs: string[]) => exprs.map(x => `(${x.trim()})`).join('&&') + ' ',

	/** Match a set of expressions and join them with "and" or "or", where each object key and value are being compared for equality.
	 * Other boolean operators can be used if object values are arrays, where [0] is the operator and [1] is the second operand */
	match: (conds: Record<string, SqlType | [SqlOp, SqlType]>, join: '&&' | '||' = '&&') =>
		Object.entries(conds).map(([k, v]) => !Array.isArray(v) ? `${k}=${_v(v)}` : `${k}${v[0]}${_v(v[1])}`).join(join) + ' ',

	/** Chain multiple statements */
	multi: (statements: string[]) => statements.map(x => x.trim()).join('; ') + ' ',
	
	/** Join a list of expressions with "or" */
	or: (exprs: string[]) => exprs.map(x => `(${x.trim()})`).join('||') + ' ',

	/** Wrap statement in parantheses */
	wrap: (expr: string, append: string = '') => `(${expr.trim()})${append} `,


	/** Create statement */
	create: <T extends object>(record: string, content: Partial<T>, ret?: SqlReturn | Selectables<T>[]) => {
		// Content string
		let json = _json(content);

		let q = `CREATE ${record} CONTENT ${json} `;
		if (ret)
			q += `RETURN ${typeof ret === 'string' ? ret : ret.join(',')} `;

		return q;
	},

	/** Relate statement */
	relate: <T extends object>(from: string, edge: string, to: string, options?: SqlRelateOptions<T>) => {
		let q = `RELATE ${from}->${edge}->${to} `;
		
		// Content string
		if (options?.content) {
			let json = _json(options.content);
			q += `CONTENT ${json} `;
		}

		// Return
		const ret = options?.return || 'NONE';
		q += `RETURN ${typeof ret === 'string' ? ret : ret.join(',')} `;

		return q;
	},

	/** Select statement */
	select: <T extends object>(fields: '*' | Selectables<T>[], options: SqlSelectOptions) => {
		let q = `SELECT ${typeof fields === 'string' ? '*' : fields.join(',')} FROM ${options.from} `;
		if (options.where)
			q += `WHERE ${options.where} `;

		return q;
	},

	/** Update statement */
	update: <T extends object>(record: string, content: Partial<T>, options?: SqlUpdateOptions<T>) => {
		let q = `UPDATE ${record} `;

		// Check if SET should be used
		if (options?.set) {
			// All must be set using merge
			const updates = { ...content, ...options.set };
			const set = Object.entries(updates).map(([k, v]) =>
				Array.isArray(v) && (v[0] === '=' || v[0] === '+=' || v[0] === '-=') ?
					`${k}${v[0]}${_v(v[1])}` :
					`${k}=${_v(v)}`
			).join(',');

			q += `SET ${set} `;
		}
		else {
			// CONTENT or MERGE should be used
			let json = _json(content);
			q += `${options?.merge === false ? 'CONTENT' : 'MERGE'} ${json} `;
		}
		
		if (options?.where)
			q += `WHERE ${options.where} `;
		if (options?.return)
			q += `RETURN ${typeof options.return === 'string' ? options.return : options.return.join(',')} `;

		return q;
	},
	
	
	/** Let statement */
	let: (name: `$${string}`, expr: string) => `LET ${name} = ${expr} `,

	/** If statement */
	if: (...blocks: { cond?: string; body: string; }[]) => {
		let q = `IF ${blocks[0].cond} THEN ${blocks[0].body.trim()} `;
		for (let i = 1; i < blocks.length; ++i) {
			const { cond, body } = blocks[i];
			q += `${cond ? `ELSE IF ${cond} THEN ` : 'ELSE '}${body.trim()} `;
		}
		q += 'END ';

		return q;
	},

	/** Transaction statement (automatically wraps multiple statements) */
	transaction: (statements: string[]) =>
		`BEGIN TRANSACTION; ${statements.map(x => x.trim()).join('; ')}; COMMIT TRANSACTION `,
};