import type { TextColor } from './text/model';

export const MAX_NOTE_LENGTH = 3000;
export const MIN_NOTE_FONT = 8;
export const MAX_NOTE_FONT = 144;
/** Size a note uses when automatic fitting is off and no size was chosen. */
export const DEFAULT_NOTE_FONT = 24;
export const TEXT_ALIGNS = ['left', 'center', 'right'] as const;
export const REACTION_EMOJI = ['👍', '❤️', '🎉', '💡', '✅', '👀'] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];
export interface Reaction {
  emoji: string;
  people: readonly string[];
}

/** Optional fields keep original boards and field-level history compatible. */
export interface NoteDetails {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textAlign?: TextAlign;
  textColor?: TextColor;
  autoFont?: boolean;
  fontSize?: number;
  groupId?: string | null;
  locked?: boolean;
  reactions?: readonly Reaction[];
}
