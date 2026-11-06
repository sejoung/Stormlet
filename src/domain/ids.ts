// Names that would alter or shadow object behaviour when used as record keys.
const reserved = new Set(['__proto__', 'constructor', 'prototype']);

export const isStickyId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && !reserved.has(value);

/** Own-property lookup: absent entries never fall through to Object.prototype. */
export const own = <T>(record: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.hasOwn(record, key) ? record[key] : undefined;
