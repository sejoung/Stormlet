import { describe, expect, it } from 'vitest';
import { mergeBoards, same } from '../../../src/domain/sync/merge';
import type { Board } from '../../../src/domain/model';
import { boardOf, frozen, sticky } from '../../support/boards';
import { frame } from '../../support/frames';
import { connection } from '../../support/connections';

const base = (): Board =>
  frozen({ ...boardOf(sticky('a'), sticky('b')), title: 'Plan', frames: { f: frame('f') } });
const edit = (board: Board, change: (copy: Board) => void): Board => {
  const copy = structuredClone(board) as Board;
  change(copy);
  return copy;
};
const note = (board: Board, id: string) => board.stickies[id] as unknown as Record<string, unknown>;

describe('three-way board merge', () => {
  it('compares values structurally, ignoring key order and undefined fields', () => {
    expect(same({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toBe(true);
    expect(same({ a: 1, gone: undefined }, { a: 1 })).toBe(true);
    expect(same({ a: [1] }, { a: { 0: 1 } })).toBe(false);
    expect(same({ a: 1 }, { a: 2 })).toBe(false);
    expect(same(null, {})).toBe(false);
  });

  it('keeps everything when nothing changed, reusing the local records', () => {
    const local = base();
    const { board, conflicts } = mergeBoards(base(), local, structuredClone(base()));
    expect(conflicts).toEqual([]);
    expect(board).toEqual(local);
    expect(board.stickies.a).toBe(local.stickies.a);
  });

  it('takes each side’s changes to different records and fields', () => {
    const local = edit(base(), (b) => {
      Object.assign(note(b, 'a'), { text: 'mine' });
      Object.assign(note(b, 'b'), { color: 'blue' });
      (b.stickies as Record<string, unknown>).c = sticky('c');
    });
    const remote = edit(base(), (b) => {
      Object.assign(note(b, 'a'), { x: 50, y: 60 });
      delete (b.stickies as Record<string, unknown>).b;
      b.title = 'Renamed';
      (b.frames as Record<string, unknown>).f = { ...frame('f'), color: 'blue' };
    });
    // Deleting `b` remotely races with recoloring it locally: that one is a conflict.
    const { board, conflicts } = mergeBoards(base(), local, remote);
    expect(board.title).toBe('Renamed');
    expect(board.stickies.a).toMatchObject({ text: 'mine', x: 50, y: 60 });
    expect(board.stickies.c).toBeDefined();
    expect(board.frames?.f.color).toBe('blue');
    expect(conflicts).toEqual([
      {
        key: 'stickies:b',
        collection: 'stickies',
        id: 'b',
        local: local.stickies.b,
        remote: undefined,
      },
    ]);
    // Unchosen conflicts keep the local side.
    expect(board.stickies.b).toEqual(local.stickies.b);
  });

  it('reports the same field changed differently on both sides and applies the chosen side', () => {
    const local = edit(base(), (b) => Object.assign(note(b, 'a'), { text: 'mine', x: 10 }));
    const remote = edit(base(), (b) => Object.assign(note(b, 'a'), { text: 'theirs', y: 20 }));
    const first = mergeBoards(base(), local, remote);
    expect(first.conflicts.map(({ key, local, remote }) => ({ key, local, remote }))).toEqual([
      { key: 'stickies:a:text', local: ['mine'], remote: ['theirs'] },
      // x and y are one position: moving it on both sides is one conflict.
      { key: 'stickies:a:position', local: [10, 0], remote: [0, 20] },
    ]);
    expect(first.board.stickies.a).toMatchObject({ text: 'mine', x: 10, y: 0 });
    const chosen = mergeBoards(base(), local, remote, (conflict) =>
      conflict.key === 'stickies:a:position' ? 'remote' : undefined,
    );
    expect(chosen.board.stickies.a).toMatchObject({ text: 'mine', x: 0, y: 20 });
  });

  it('merges a line’s stroke width on its own, and keeps text sizes as one', () => {
    const start = frozen({
      ...boardOf(sticky('a'), sticky('b'), sticky('t', { objectType: 'text' })),
      connections: { line: connection('line') },
    });
    const line = (b: Board) =>
      (b.connections as unknown as Record<string, Record<string, unknown>>).line;
    const local = edit(start, (b) => {
      line(b).width = 4;
      Object.assign(note(b, 't'), { width: 200 });
    });
    const remote = edit(start, (b) => {
      line(b).width = 6;
      Object.assign(note(b, 't'), { height: 80 });
    });
    const { conflicts } = mergeBoards(start, local, remote);
    expect(conflicts.map(({ key, local, remote }) => ({ key, local, remote }))).toEqual([
      { key: 'stickies:t:size', local: [200, 120], remote: [160, 80] },
      { key: 'connections:line:width', local: [4], remote: [6] },
    ]);
  });

  it('agrees silently when both sides made the same change, and drops removed fields', () => {
    const local = edit(base(), (b) => {
      Object.assign(note(b, 'a'), { text: 'same' });
      delete (b.frames as unknown as Record<string, Record<string, unknown>>).f.locked;
    });
    const remote = edit(base(), (b) => Object.assign(note(b, 'a'), { text: 'same', color: 'red' }));
    const { board, conflicts } = mergeBoards(base(), local, remote);
    expect(conflicts).toEqual([]);
    expect(board.stickies.a).toMatchObject({ text: 'same', color: 'red' });
    expect(board.frames?.f).not.toHaveProperty('locked');
  });

  it('reports competing titles and records added under the same ID', () => {
    const local = edit(base(), (b) => {
      b.title = 'Mine';
      (b.stickies as Record<string, unknown>).n = sticky('n', { text: 'one' });
    });
    const remote = edit(base(), (b) => {
      delete b.title;
      (b.stickies as Record<string, unknown>).n = sticky('n', { text: 'two' });
    });
    const { board, conflicts } = mergeBoards(base(), local, remote, () => 'remote');
    expect(conflicts.map((conflict) => conflict.key)).toEqual(['title', 'stickies:n']);
    expect(board).not.toHaveProperty('title');
    expect(board.stickies.n.text).toBe('two');
  });

  it('drops lines that lost an end to the other side’s deletion, and empty collections', () => {
    const start = frozen({
      ...boardOf(sticky('a'), sticky('b')),
      connections: {
        line: connection('line', {
          from: { stickyId: 'a', side: 'auto' },
          to: { stickyId: 'b', side: 'auto' },
        }),
      },
    });
    const local = edit(start, (b) => {
      (b.connections as unknown as Record<string, Record<string, unknown>>).line.label = 'kept?';
    });
    const remote = edit(start, (b) => delete (b.stickies as Record<string, unknown>).b);
    const { board, conflicts } = mergeBoards(start, local, remote);
    expect(conflicts).toEqual([]);
    expect(board.stickies).not.toHaveProperty('b');
    expect(board).not.toHaveProperty('connections');
    expect(board).not.toHaveProperty('frames');
  });
});
