import { FILE_EXTENSION } from './stormlet-format';

const stem = (name: string) =>
  name.endsWith(FILE_EXTENSION) ? name.slice(0, -FILE_EXTENSION.length) : name;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `name` with ` (n)` before its extension, as Drive and file managers number copies. */
export const numberedName = (name: string, n: number): string =>
  n < 2 ? name : `${stem(name)} (${n})${FILE_EXTENSION}`;

/** Whether `name` is `base` or a numbered copy of it, so the file needs no renaming. */
export const isNameFor = (name: string, base: string): boolean =>
  name === base ||
  new RegExp(`^${escape(stem(base))} \\(\\d+\\)${escape(FILE_EXTENSION)}$`).test(name);

/** `base`, or the first numbered name of it that no file in `taken` has. */
export function freeName(base: string, taken: ReadonlySet<string>): string {
  for (let n = 1; ; n++) if (!taken.has(numberedName(base, n))) return numberedName(base, n);
}
