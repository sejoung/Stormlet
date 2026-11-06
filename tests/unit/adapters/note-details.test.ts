import { describe, expect, it } from 'vitest';
import {
  FormatError,
  parseBoard,
  serializeBoard,
} from '../../../src/adapters/files/stormlet-format';
import { boardOf, sticky } from '../../support/boards';

const file = (details: Record<string, unknown>) =>
  JSON.stringify({ format: 'stormlet', version: 4, stickies: [{ ...sticky('a'), ...details }] });

describe('extended note persistence', () => {
  it('round-trips every new field and strips unknown imported fields', () => {
    const board = boardOf(
      sticky('a', {
        color: 'teal',
        bold: true,
        italic: true,
        underline: true,
        textAlign: 'right',
        autoFont: false,
        fontSize: 32,
        tags: ['실험', '다음 할 일'],
        author: '작성자',
        showAuthor: true,
        groupId: 'group-1',
        locked: true,
        reactions: [{ emoji: '👍', people: ['A', 'B'] }],
      }),
    );
    const json = serializeBoard(board);
    expect(JSON.parse(json).version).toBe(4);
    expect(parseBoard(json)).toStrictEqual(board);
    expect(parseBoard(file({ unknown: '<script>', groupId: null })).stickies.a).not.toHaveProperty(
      'unknown',
    );
  });

  it.each([
    { bold: 'yes' },
    { italic: 1 },
    { underline: null },
    { autoFont: [] },
    { locked: 1 },
    { showAuthor: 'true' },
    { textAlign: 'justify' },
    { fontSize: 0 },
    { fontSize: 145 },
    { author: 'x'.repeat(51) },
    { groupId: {} },
    { groupId: 'bad group' },
    { tags: ['same', 'same'] },
    { tags: Array(9).fill('x') },
    { tags: [''] },
    { tags: [99] },
    { reactions: [null] },
    { reactions: [{ emoji: '👍', people: 'A' }] },
    { reactions: [{ emoji: '👍', people: ['A', 'A'] }] },
    {
      reactions: [
        { emoji: '👍', people: ['A'] },
        { emoji: '👍', people: ['B'] },
      ],
    },
    { reactions: [{ emoji: '👍', people: ['x'.repeat(51)] }] },
  ])('rejects malformed details %j', (details) => {
    expect(() => parseBoard(file(details))).toThrow(FormatError);
  });

  it('keeps a version 3 board unchanged and writes it as version 4', () => {
    const note = sticky('a', { width: 260, height: 180 });
    const before = JSON.stringify({ format: 'stormlet', version: 3, stickies: [note] });
    const board = parseBoard(before);
    expect(board).toEqual(boardOf(note));
    expect(parseBoard(serializeBoard(board))).toStrictEqual(board);
  });
});
