import type { NoteDetails, Reaction } from '../../domain/note-details';

/** Validate optional v4 fields without retaining unknown imported properties. */
export function readDetails(item: Record<string, unknown>): NoteDetails {
  const result: Record<string, unknown> = {};
  const accept = (key: keyof NoteDetails, valid: (value: unknown) => boolean) => {
    if (item[key] === undefined) return;
    if (!valid(item[key])) throw new Error(`Invalid ${key}.`);
    result[key] = item[key];
  };
  for (const key of ['bold', 'italic', 'underline', 'autoFont', 'locked'] as const)
    accept(key, (v) => typeof v === 'boolean');
  accept('textAlign', (v) => ['left', 'center', 'right'].includes(v as string));
  accept('fontSize', (v) => typeof v === 'number' && Number.isFinite(v) && v >= 8 && v <= 144);
  accept('groupId', (v) => v === null || (typeof v === 'string' && /^[\w-]{1,128}$/.test(v)));
  accept(
    'reactions',
    (v) =>
      Array.isArray(v) &&
      v.length <= 16 &&
      new Set(v.map((r) => r?.emoji)).size === v.length &&
      v.every(
        (r: Reaction) =>
          r &&
          typeof r.emoji === 'string' &&
          r.emoji.length <= 16 &&
          Array.isArray(r.people) &&
          r.people.length <= 100 &&
          new Set(r.people).size === r.people.length &&
          r.people.every((p) => typeof p === 'string' && p.length > 0 && p.length <= 50),
      ),
  );
  return result as NoteDetails;
}
