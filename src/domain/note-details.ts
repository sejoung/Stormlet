export const MAX_NOTE_LENGTH = 3000;
export const REACTION_EMOJI = ['👍', '❤️', '🎉', '💡', '✅', '👀'] as const;
export type TextAlign = 'left' | 'center' | 'right';
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
  autoFont?: boolean;
  fontSize?: number;
  groupId?: string | null;
  locked?: boolean;
  reactions?: readonly Reaction[];
}
