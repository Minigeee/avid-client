/**
 * Get the id of a SQL record.
 *
 * @param record The record to get id from
 * @returns A string containing the id part of the original record
 */
export function id(record: string) {
  return record.split(':').at(-1) as string;
}

/**
 * Create a record out of the given id
 *
 * @param record The record to get id from
 * @returns A string containing the id part of the original record
 */
export function record(table: string, id: string) {
  return `${table}:${id}`;
}
