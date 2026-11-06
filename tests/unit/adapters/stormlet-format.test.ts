import { describe, expect, it } from 'vitest';
import {
  FormatError,
  parseBoard,
  serializeBoard,
} from '../../../src/adapters/files/stormlet-format';
import { boardOf, sticky } from '../../support/boards';
import { KIND_COLORS, STICKY_KINDS } from '../../../src/domain/model';

const file = (stickies: unknown, extra = {}) =>
  JSON.stringify({ format: 'stormlet', version: 2, stickies, ...extra });

describe('.stormlet format', () => {
  it('round-trips a board and lists stickies bottom to top', () => {
    const board = boardOf(
      sticky('top', { z: 9, kind: null, color: 'green' }),
      sticky('bottom', { z: 1, kind: 'actor', color: 'blue' }),
    );
    const content = serializeBoard(board);
    expect(JSON.parse(content).stickies.map((s: { id: string }) => s.id)).toEqual([
      'bottom',
      'top',
    ]);
    expect(parseBoard(content)).toEqual(board);
  });

  it.each([
    ['not JSON', '{'],
    ['another format', JSON.stringify({ format: 'maplet', version: 1, stickies: [] })],
    ['a newer version', file([], { version: 3 })],
    ['an invalid version', file([], { version: 0 })],
    ['no stickies', JSON.stringify({ format: 'stormlet', version: 1 })],
    ['a malformed sticky', file([{ ...sticky('a'), kind: 'note' }])],
    ['an invalid color', file([{ ...sticky('a'), color: 'cyan' }])],
    ['a missing color', file([{ ...sticky('a'), color: undefined }])],
    ['a reserved ID', file([sticky('__proto__')])],
    ['a duplicate ID', file([sticky('a'), sticky('a')])],
    ['a null file', 'null'],
  ])('refuses %s', (_, content) => {
    expect(() => parseBoard(content)).toThrow(FormatError);
  });

  it('migrates original event storming boards with their colors and roles intact', () => {
    const original = STICKY_KINDS.map((kind, index) => ({
      id: `s${index}`,
      kind,
      text: kind,
      x: index * 180,
      y: 0,
      z: index,
    }));
    const board = parseBoard(file(original, { version: 1 }));
    for (const note of original)
      expect(board.stickies[note.id]).toEqual({ ...note, color: KIND_COLORS[note.kind] });
    expect(parseBoard(serializeBoard(board))).toEqual(board);
  });
});
