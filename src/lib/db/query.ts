import axios from 'axios';

import config from '@/config';
import assert from 'assert';


/**
 * Make a query to SurrealDB
 * 
 * @param sql The query string
 * @returns A promise for the query results
 */
export async function query<T>(sql: string): Promise<T> {
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
			Authorization: !is_server ? `Bearer ${''}` : undefined,
			Accept: 'application/json',
			NS: config.db.namespace,
			DB: config.db.database,
		},
	});

	// TODO : Error handling

	return result.data.at(-1).result;
}


/** Operators */
export type SqlOp = '&&' | '||' | '??' | '?:' | '=' | '!=' | '==' | '?=' | '*=' | '~'
	| '!~' | '*~' | '<' | '<=' | '>' | '>=' | '+' | '-' | '*' | '/'
	| '**' | 'IN' | 'NOT IN' | 'CONTAINS' | 'CONTAINSNOT' | 'CONTAINSALL' | 'CONTAINSANY' | 'CONTAINSNONE'
	| 'INSIDE' | 'NOTINSIDE' | 'ALLINSIDE' | 'ANYINSIDE' | 'NONEINSIDE' | 'OUTSIDE' | 'INTERSECTS';

/** Return modes */
export type SqlReturn = 'NONE' | 'BEFORE' | 'DIFF';

/** Select statement options */
export type SqlSelectOptions = {
	/** Table to select from */
	from: string;
	/** Select condition */
	where?: string;
};

/** Update statement options */
export type SqlUpdateOptions = {
	/** Update condition */
	where?: string;
	/** Return mode */
	return?: SqlReturn | string[];
	/** Whether update should merge or replace data (merge by default) */
	merge?: boolean;
};

type SqlType = number | string;

function _v(x: SqlType) {
	return typeof x === 'string' ? `"${x}"` : x;
}

/** SQL commands in function form for ease of use and future proofing */
export const sql = {
	/** Join a list of expressions with "and" */
	and: (exprs: string[]) => exprs.map(x => `(${x.trim()})`).join('&&'),

	/** Match a set of expressions and join them with "and" or "or", where each object key and value are being compared for equality.
	 * Other boolean operators can be used if object values are arrays, where [0] is the operator and [1] is the second operand */
	match: (conds: Record<string, SqlType | [SqlOp, SqlType]>, join: '&&' | '||' = '&&') =>
		Object.entries(conds).map(([k, v]) => !Array.isArray(v) ? `${k}=${_v(v)}` : `${k}${v[0]}${_v(v[1])}`).join(join) + ' ',

	/** Chain multiple statements */
	multi: (statements: string[]) => statements.map(x => x.trim()).join('; ') + ' ',
	
	/** Join a list of expressions with "or" */
	or: (exprs: string[]) => exprs.map(x => `(${x.trim()})`).join('||'),


	/** Create statement */
	create: (table: string, content: object, ret?: SqlReturn | string[]) => {
		// Content string
		let json = JSON.stringify(content);
		json.replace(/\\"/g, "\uFFFF");  // U+ FFFF
		json = json.replace(/"([^"]+)":/g, '$1:').replace(/\uFFFF/g, '\\\"');

		let q = `CREATE ${table} CONTENT ${json} `;
		if (ret)
			q += `RETURN ${typeof ret === 'string' ? ret : ret.join(',')} `;

		return q;
	},

	/** Select statement */
	select: (fields: '*' | string[], options: SqlSelectOptions) => {
		let q = `SELECT ${typeof fields === 'string' ? '*' : fields.join(',')} FROM ${options.from} `;
		if (options.where)
			q += `WHERE ${options.where} `;

		return q;
	},

	/** Update statement */
	update: (table: string, content: object, options?: SqlUpdateOptions) => {
		// Content string
		let json = JSON.stringify(content);
		json.replace(/\\"/g, "\uFFFF");  // U+ FFFF
		json = json.replace(/"([^"]+)":/g, '$1:').replace(/\uFFFF/g, '\\\"');

		let q = `UPDATE ${table} ${options?.merge === false ? 'CONTENT' : 'MERGE'} ${json} `;
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
};