import type { Board } from './model';
import type { Patch } from './patch';

/** Generated titles are data, so they are English in every language for consistency. */
export const DEFAULT_BOARD_TITLE = 'My idea board';
export const MAX_BOARD_TITLE_LENGTH = 80;

export const normalizeBoardTitle = (value: string): string =>
  value
    .replace(/\s+/g, ' ')
    .replace(/\p{Cc}/gu, '')
    .trim()
    .slice(0, MAX_BOARD_TITLE_LENGTH) || DEFAULT_BOARD_TITLE;

export const boardTitle = (board: Board): string => board.title ?? DEFAULT_BOARD_TITLE;

export function renameBoard(board: Board, value: string): Patch[] {
  const title = normalizeBoardTitle(value);
  return title === boardTitle(board) ? [] : [{ op: 'title', value: title }];
}

/** Keep the visible title intact while removing characters forbidden in download names. */
export const boardFileStem = (title: string): string =>
  normalizeBoardTitle(title)
    .replace(/\.stormlet$/i, '')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/^[. ]+|[. ]+$/g, '') || DEFAULT_BOARD_TITLE;
