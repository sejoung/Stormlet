/** Text shares note geometry and commands, with no paper or shadow (ADR 0015). */
export const isText = (item: { objectType?: 'text' }): boolean => item.objectType === 'text';
export const DEFAULT_TEXT_SIZE = { width: 320, height: 100 } as const;
export const MIN_TEXT_SIZE = { width: 16, height: 16 } as const;
export const TEXT_PADDING = 4;
export const TEXT_COLORS = [
  'default',
  'black',
  'gray',
  'red',
  'orange',
  'green',
  'blue',
  'purple',
] as const;
export type TextColor = (typeof TEXT_COLORS)[number];

export const isTextColor = (value: unknown): value is TextColor =>
  (TEXT_COLORS as readonly unknown[]).includes(value);
