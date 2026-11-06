import { describe, expect, it } from 'vitest';
import {
  boardTitle,
  boardFileStem,
  normalizeBoardTitle,
  DEFAULT_BOARD_TITLE,
  MAX_BOARD_TITLE_LENGTH,
} from '../../../src/domain/board-title';
import { applyPatches, diffBoards } from '../../../src/domain/patch';
import { boardOf, sticky } from '../../support/boards';
import {
  parseBoard,
  serializeBoard,
  FormatError,
} from '../../../src/adapters/files/stormlet-format';

describe('board titles', () => {
  it('normalizes visible names and produces safe filenames without changing the visible title', () => {
    expect(boardTitle(boardOf())).toBe(DEFAULT_BOARD_TITLE);
    expect(normalizeBoardTitle('  팀   회고\n보드  ')).toBe('팀 회고 보드');
    expect(normalizeBoardTitle('  ')).toBe(DEFAULT_BOARD_TITLE);
    expect(normalizeBoardTitle('x'.repeat(100))).toHaveLength(MAX_BOARD_TITLE_LENGTH);
    expect(boardFileStem('회고/기획: 1차')).toBe('회고-기획- 1차');
    expect(boardFileStem('실험.stormlet')).toBe('실험');
    expect(boardFileStem('...')).toBe(DEFAULT_BOARD_TITLE);
  });

  it('undoes title edits independently and preserves names when notes change', () => {
    const before = boardOf(sticky('a'));
    const named = applyPatches(before, [{ op: 'title', value: '회고' }]);
    expect(boardTitle(named.board)).toBe('회고');
    expect(
      applyPatches(named.board, [{ op: 'set', id: 'a', field: 'text', value: '새 생각' }]).board
        .title,
    ).toBe('회고');
    expect(applyPatches(named.board, [{ op: 'title', value: '회고' }]).board).toBe(named.board);
    expect(applyPatches(named.board, named.inverse).board).toStrictEqual(before);
    expect(applyPatches(named.board, diffBoards(named.board, before)).board).toStrictEqual(before);
    expect(parseBoard(serializeBoard(named.board))).toStrictEqual(named.board);
  });

  it.each(['', ' ', 'x'.repeat(81), 42, null, '줄\n바꿈'])(
    'rejects an invalid persisted title %j',
    (title) => {
      expect(() =>
        parseBoard(JSON.stringify({ format: 'stormlet', version: 5, title, stickies: [] })),
      ).toThrow(FormatError);
    },
  );
});
