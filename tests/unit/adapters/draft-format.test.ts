import { describe, expect, it } from 'vitest';
import {
  FormatError,
  parseBoard,
  serializeBoard,
} from '../../../src/adapters/files/stormlet-format';
import { contains } from '../../../src/domain/frames/model';
import { DEFAULT_CONNECTION } from '../../../src/domain/connections/model';
import { sticky } from '../../support/boards';

const draft = (body: object) => JSON.stringify({ format: 'stormlet', version: 12, ...body });

describe('draft board files (ADR 0017)', () => {
  it('opens a file without coordinates as a laid-out board', () => {
    const board = parseBoard(
      draft({
        title: 'KPT',
        frames: [{ id: 'keep', title: 'Keep' }, { id: 'try' }],
        stickies: [
          { id: 'k1', frame: 'keep', text: 'Deploys are automatic', color: 'green' },
          { id: 'k2', frame: 'keep', text: 'Reviews are quick' },
          { id: 't1', frame: 'try', text: 'Pair on hard bugs' },
          { id: 'note', objectType: 'text', text: 'Sprint 12' },
        ],
      }),
    );
    const frames = board.frames!;
    for (const id of ['k1', 'k2']) expect(contains(frames.keep, board.stickies[id])).toBe(true);
    expect(contains(frames.try, board.stickies.t1)).toBe(true);
    expect(board.stickies.k2).toMatchObject({ kind: null, color: 'yellow', width: 160 });
    expect(board.stickies.note).toMatchObject({ width: 320, height: 100 });
    expect(frames.try).toMatchObject({ title: 'Frame', color: 'none', borderWidth: 2 });
    expect(frames.try.locked).toBe(false);
  });

  it('saves a laid-out draft as a complete file that reopens unchanged', () => {
    const board = parseBoard(draft({ stickies: [{ id: 'a' }, { id: 'b', text: 'b' }] }));
    const saved = JSON.parse(serializeBoard(board));
    for (const note of saved.stickies)
      expect(Object.keys(note)).toEqual(expect.arrayContaining(['x', 'y', 'z', 'width']));
    expect(parseBoard(serializeBoard(board))).toEqual(board);
  });

  it('reads lines that name their ends by ID and take the default style', () => {
    const board = parseBoard(
      draft({
        frames: [{ id: 'f' }],
        stickies: [{ id: 'a' }, { id: 'b' }],
        connections: [
          { from: 'a', to: 'b', label: 'then' },
          { id: 'line-1', from: { stickyId: 'b' }, to: 'f', dashed: true },
          { from: 'a', to: 'missing' },
        ],
      }),
    );
    const lines = Object.values(board.connections!);
    expect(lines).toHaveLength(2);
    expect(lines.find((line) => line.label === 'then')).toMatchObject({
      ...DEFAULT_CONNECTION,
      label: 'then',
      from: { stickyId: 'a', side: 'auto' },
      to: { stickyId: 'b', side: 'auto' },
    });
    expect(board.connections!['line-1']).toMatchObject({
      dashed: true,
      to: { frameId: 'f', side: 'auto' },
    });
  });

  it.each([
    ['a note without an ID', { stickies: [{ text: 'a' }] }],
    ['a drawing without its box', { stickies: [{ id: 'd', objectType: 'drawing', ink: [] }] }],
    ['an unknown color', { stickies: [{ id: 'a', color: 'cyan' }] }],
    ['an unknown frame layout', { frames: [{ id: 'f', layout: 'spiral' }], stickies: [] }],
    ['an oversized frame', { frames: [{ id: 'f', width: 99999 }], stickies: [] }],
  ])('refuses %s', (_, body) => {
    expect(() => parseBoard(draft(body))).toThrow(FormatError);
  });

  it('still requires positions in older files and ignores a frame hint there', () => {
    const old = (stickies: unknown[]) =>
      JSON.stringify({ format: 'stormlet', version: 11, stickies });
    expect(() => parseBoard(old([{ ...sticky('a'), x: undefined }]))).toThrow(FormatError);
    expect(parseBoard(old([{ ...sticky('a'), frame: 'f' }])).stickies.a).toEqual(sticky('a'));
  });
});

describe('icons and nested drafts (ADR 0018)', () => {
  const v13 = (body: object) => JSON.stringify({ format: 'stormlet', version: 13, ...body });

  it('keeps a note icon, and drops one from files older than version 13', () => {
    const board = parseBoard(v13({ stickies: [{ id: 'db', icon: 'database' }] }));
    expect(board.stickies.db.icon).toBe('database');
    expect(parseBoard(serializeBoard(board))).toEqual(board);
    const old = parseBoard(draft({ stickies: [{ id: 'db', icon: 'database' }] }));
    expect(old.stickies.db.icon).toBeUndefined();
  });

  it('refuses an unknown icon or board layout', () => {
    expect(() => parseBoard(v13({ stickies: [{ id: 'a', icon: 'aws-lambda' }] }))).toThrow(
      FormatError,
    );
    expect(() => parseBoard(v13({ layout: 'spiral', stickies: [] }))).toThrow(FormatError);
  });

  it('lays out nested frames along the lines of a flow board', () => {
    const board = parseBoard(
      v13({
        layout: 'flow',
        frames: [
          { id: 'cloud', title: 'Cloud' },
          { id: 'private', title: 'Private subnet', frame: 'cloud', layout: 'column' },
        ],
        stickies: [
          { id: 'user', icon: 'user', text: 'User' },
          { id: 'api', frame: 'private', icon: 'server', text: 'API' },
          { id: 'db', frame: 'private', icon: 'database', text: 'DB' },
        ],
        connections: [
          { from: 'user', to: 'api' },
          { from: { stickyId: 'api' }, to: 'db' },
        ],
      }),
    );
    const { cloud, private: subnet } = board.frames!;
    expect(contains(cloud, subnet)).toBe(true);
    expect(contains(subnet, board.stickies.db)).toBe(true);
    expect(board.stickies.user.x + board.stickies.user.width).toBeLessThan(cloud.x);
  });
});
