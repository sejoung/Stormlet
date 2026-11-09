import { describe, expect, it } from 'vitest';
import {
  parseBoard,
  serializeBoard,
  FormatError,
} from '../../../src/adapters/files/stormlet-format';
import { readFrames } from '../../../src/adapters/files/frames';
import { frame } from '../../support/frames';
import { boardOf } from '../../support/boards';

describe('frame files', () => {
  it('round-trips transparent and colored frames, excludes unknown properties and accepts old files', () => {
    const board = {
      ...boardOf(),
      frames: { a: frame('a'), b: frame('b', { color: 'blue', locked: true }) },
    };
    const content = serializeBoard(board);
    expect(JSON.parse(content).version).toBe(10);
    expect(parseBoard(content)).toEqual(board);
    const extra = JSON.parse(content);
    extra.frames[0].ignored = 'discard';
    expect(parseBoard(JSON.stringify(extra))).toEqual(board);
    for (const version of [5, 6])
      expect(parseBoard(JSON.stringify({ format: 'stormlet', version, stickies: [] }))).toEqual(
        boardOf(),
      );
    expect(readFrames(undefined)).toEqual({});
  });
  it('migrates version 7 frames to a visible border and persists frame endpoints and border widths', () => {
    const legacy = { ...frame('a') } as Partial<ReturnType<typeof frame>>;
    delete legacy.borderWidth;
    expect(
      parseBoard(JSON.stringify({ format: 'stormlet', version: 7, stickies: [], frames: [legacy] }))
        .frames?.a.borderWidth,
    ).toBe(2);
    const board = {
      ...boardOf(),
      frames: { a: frame('a', { borderWidth: 8 }), b: frame('b', { x: 1000 }) },
      connections: {
        line: {
          id: 'line',
          from: { frameId: 'a', side: 'right' as const },
          to: { frameId: 'b', side: 'left' as const },
          path: 'elbow' as const,
          color: 'slate' as const,
          width: 2,
          startArrow: false,
          endArrow: true,
          dashed: false,
          label: '',
        },
      },
    };
    expect(parseBoard(serializeBoard(board))).toEqual(board);
    for (const value of [undefined, 0, 5, '2']) {
      const malformed = { ...frame('a'), borderWidth: value };
      expect(() =>
        parseBoard(
          JSON.stringify({ format: 'stormlet', version: 8, stickies: [], frames: [malformed] }),
        ),
      ).toThrow(FormatError);
    }
    for (const from of [
      { frameId: 'gone', side: 'right' },
      { frameId: '__proto__', side: 'right' },
      { frameId: 'a', stickyId: 'a', side: 'right' },
      { frameId: 'a', side: 'bad' },
    ]) {
      const bad = JSON.parse(serializeBoard(board));
      bad.connections[0].from = from;
      expect(() => parseBoard(JSON.stringify(bad))).toThrow(FormatError);
    }
  });
  it.each(
    (
      [
        null,
        {},
        [null],
        [frame('__proto__')],
        [frame('a'), frame('a')],
        [frame('a', { title: '' })],
        [frame('a', { title: 'x'.repeat(101) })],
        [frame('a', { width: 159 })],
        [frame('a', { height: 20001 })],
        [frame('a', { color: 'invalid' as never })],
        [frame('a', { locked: null as never })],
        [frame('a', { x: Infinity })],
        [frame('a', { width: 640.5 })],
      ] as unknown[]
    ).map((raw) => [raw]),
  )('refuses malformed frames: %j', (raw) => {
    const content = JSON.stringify({ format: 'stormlet', version: 8, stickies: [], frames: raw });
    expect(() => parseBoard(content)).toThrow(FormatError);
  });
});
