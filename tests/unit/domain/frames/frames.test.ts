import { describe, expect, it } from 'vitest';
import {
  addFrame,
  updateFrame,
  moveFrame,
  deleteFrame,
  frameContents,
  boundsAroundNotes,
  cloneFrameContents,
  cutFrameContents,
} from '../../../../src/domain/frames/commands';
import { containsFrame } from '../../../../src/domain/frames/model';
import { applyPatches, diffBoards } from '../../../../src/domain/patch';
import { DEFAULT_CONNECTION } from '../../../../src/domain/connections/model';
import type { Board } from '../../../../src/domain/model';
import { boardOf, sticky } from '../../../support/boards';
import { frame } from '../../../support/frames';

const board = (): Board => ({
  ...boardOf(
    sticky('a', { x: 40, y: 40 }),
    sticky('b', { x: 300, y: 40, locked: true }),
    sticky('edge', { x: 600 }),
    sticky('outside', { x: 800 }),
  ),
  frames: {
    root: frame('root'),
    child: frame('child', { x: 20, y: 20, width: 520, height: 260 }),
    sibling: frame('sibling', { x: 800 }),
  },
  connections: {
    attached: {
      ...DEFAULT_CONNECTION,
      id: 'attached',
      from: { stickyId: 'a', side: 'right' },
      to: { stickyId: 'b', side: 'left' },
    },
    free: { ...DEFAULT_CONNECTION, id: 'free', from: { x: 10, y: 10 }, to: { x: 600, y: 380 } },
    cross: {
      ...DEFAULT_CONNECTION,
      id: 'cross',
      from: { x: 100, y: 200 },
      to: { stickyId: 'outside', side: 'auto' },
    },
  },
});

describe('frames', () => {
  it('cuts the whole frame and contents without leaving dangling incident connections', () => {
    const source = board();
    const result = applyPatches(source, cutFrameContents(source, 'root'));
    expect(Object.keys(result.board.stickies)).toEqual(['edge', 'outside']);
    expect(Object.keys(result.board.frames!)).toEqual(['sibling']);
    expect(result.board.connections?.attached).toBeUndefined();
    expect(result.board.connections?.free).toBeUndefined();
    expect(result.board.connections?.cross).toEqual(source.connections?.cross);
    expect(applyPatches(result.board, result.inverse).board).toEqual(source);
    expect(cutFrameContents(source, 'missing')).toEqual([]);
    const locked = applyPatches(source, updateFrame(source, 'root', { locked: true })).board;
    expect(cutFrameContents(locked, 'root')).toEqual([]);
  });
  it('numbers new frames past every existing number, so titles never repeat', () => {
    const board = boardOf();
    const first = applyPatches(board, addFrame(board, 'a', frame('a'))).board;
    expect(first.frames?.a.title).toBe('프레임 1');
    const second = applyPatches(first, addFrame(first, 'b', frame('b'))).board;
    const afterDelete = applyPatches(second, deleteFrame(second, 'a')).board;
    expect(
      applyPatches(afterDelete, addFrame(afterDelete, 'c', frame('c'))).board.frames?.c.title,
    ).toBe('프레임 3');
  });

  it('moves frames to whole board units', () => {
    const source = board();
    const moved = applyPatches(source, moveFrame(source, 'root', 10.4, -0.6)).board;
    expect(moved.frames?.root).toMatchObject({ x: 10, y: -1 });
    expect(moved.stickies.a).toMatchObject({ x: 50, y: 39 });
  });

  it('creates transparent frames, clamps dimensions and refuses invalid input', () => {
    const empty = boardOf();
    const added = applyPatches(
      empty,
      addFrame(empty, 'new', { x: 20, y: 30, width: 12, height: 5 }),
    ).board;
    expect(added.frames?.new).toMatchObject({
      x: 20,
      y: 30,
      width: 160,
      height: 120,
      color: 'none',
    });
    expect(addFrame(added, 'new', frame())).toEqual([]);
    expect(addFrame(empty, '__proto__', frame())).toEqual([]);
    expect(addFrame(empty, 'new', frame('x', { width: NaN }))).toEqual([]);
    const change = updateFrame(added, 'new', { title: '  레인 A  ', color: 'blue', width: 30000 });
    const updated = applyPatches(added, change);
    expect(updated.board.frames?.new).toMatchObject({
      title: '레인 A',
      color: 'blue',
      width: 20000,
      height: 120,
    });
    expect(applyPatches(updated.board, updated.inverse).board).toEqual(added);
    expect(
      applyPatches(added, updateFrame(added, 'new', { title: ' ' })).board.frames?.new.title,
    ).toBe('프레임');
    expect(updateFrame(added, 'missing', { title: 'x' })).toEqual([]);
    expect(updateFrame(added, 'new', { height: NaN })).toEqual([]);
  });

  it('moves nested frames, contained notes and free ends once, leaving partial overlaps outside', () => {
    const source = board();
    const result = applyPatches(source, moveFrame(source, 'root', 80, -20));
    expect(result.board.frames?.child).toMatchObject({ x: 100, y: 0 });
    expect(result.board.frames?.sibling).toEqual(source.frames?.sibling);
    expect(result.board.stickies.a).toMatchObject({ x: 120, y: 20 });
    expect(result.board.stickies.b).toMatchObject({ x: 380, y: 20, locked: true });
    expect(result.board.stickies.edge).toEqual(source.stickies.edge);
    expect(result.board.connections?.free.from).toEqual({ x: 90, y: -10 });
    expect(result.board.connections?.cross.from).toEqual({ x: 180, y: 180 });
    expect(result.board.connections?.cross.to).toEqual(source.connections?.cross.to);
    expect(result.board.connections?.attached).toEqual(source.connections?.attached);
    expect(applyPatches(result.board, result.inverse).board).toEqual(source);
    expect(source.frames?.root.x).toBe(0);
  });

  it('derives membership anew after notes are moved in and out and keeps equal frames as siblings', () => {
    const source = board();
    const moved = applyPatches(source, [
      { op: 'set', id: 'a', field: 'x', value: 1000 },
      { op: 'set', id: 'outside', field: 'x', value: 10 },
    ]).board;
    const contents = frameContents(moved, 'root');
    expect(Object.keys(contents.stickies)).toEqual(['b', 'outside']);
    expect(Object.keys(contents.connections ?? {})).toEqual(['free', 'cross']);
    expect(frameContents(source, 'missing')).toEqual(boardOf());
    expect(containsFrame(frame('a'), frame('b'))).toBe(false);
    expect(containsFrame(frame('a'), frame('b', { width: 300 }))).toBe(true);
  });

  it('resizes just the boundary and deletes just the frame; locks protect frame edits', () => {
    const source = board();
    const resized = applyPatches(
      source,
      updateFrame(source, 'root', { width: 300, height: 200 }),
    ).board;
    expect(resized.stickies).toBe(source.stickies);
    const deleted = applyPatches(source, deleteFrame(source, 'root'));
    expect(deleted.board.frames?.root).toBeUndefined();
    expect(deleted.board.stickies).toBe(source.stickies);
    expect(deleted.board.connections).toBe(source.connections);
    expect(deleted.board.frames?.child).toEqual(source.frames?.child);
    expect(applyPatches(deleted.board, deleted.inverse).board).toEqual(source);
    const locked = applyPatches(source, updateFrame(source, 'root', { locked: true })).board;
    expect(updateFrame(locked, 'root', { title: 'blocked' })).toEqual([]);
    expect(deleteFrame(locked, 'root')).toEqual([]);
    expect(deleteFrame(source, 'missing')).toEqual([]);
    expect(moveFrame(locked, 'root', 10, 20)).toEqual([]);
    expect(moveFrame(source, 'root', 0, 0)).toEqual([]);
    expect(moveFrame(source, 'root', NaN, 1)).toEqual([]);
    expect(moveFrame(source, 'missing', 1, 1)).toEqual([]);
    expect(applyPatches(locked, updateFrame(locked, 'root', { locked: false })).board).toEqual(
      source,
    );
  });

  it('surrounds existing notes with padding, copies internal flows and maps nested frame IDs', () => {
    const source = board();
    expect(boundsAroundNotes(source, ['a', 'b', 'missing'])).toEqual({
      x: 8,
      y: 8,
      width: 484,
      height: 184,
    });
    expect(boundsAroundNotes(source, ['missing'])).toBeNull();
    const contents = frameContents(source, 'root');
    let id = 0;
    const copied = cloneFrameContents(contents, source, () => `copy${++id}`, 700, 20);
    const result = applyPatches(source, copied.patches);
    expect(copied.frameIds.size).toBe(2);
    expect(result.board.frames?.[copied.frameIds.get('root')!]).toMatchObject({ x: 700, y: 20 });
    const copyA = Object.values(result.board.stickies).find(
      (note) => note.text === 'a' && note.id !== 'a',
    )!;
    expect(copyA).toMatchObject({ x: 740, y: 60, locked: false });
    const lines = Object.values(result.board.connections!).filter(
      (line) => !source.connections?.[line.id],
    );
    expect(lines).toHaveLength(2);
    expect(lines.find((line) => 'stickyId' in line.from)?.from).toMatchObject({
      stickyId: copyA.id,
    });
    expect(lines.find((line) => !('stickyId' in line.from))?.from).toEqual({ x: 710, y: 30 });
    expect(applyPatches(result.board, result.inverse).board).toEqual(source);
  });

  it('diffs frame additions, updates and removals for outside changes and undo', () => {
    const source = board();
    const target = {
      ...source,
      frames: { root: frame('root', { title: '새 이름', color: 'green' }), next: frame('next') },
    };
    const result = applyPatches(source, diffBoards(source, target));
    expect(result.board).toEqual(target);
    expect(applyPatches(result.board, result.inverse).board).toEqual(source);
    const absent = applyPatches(boardOf(), [
      { op: 'frame:delete', id: 'gone' },
      { op: 'frame:set', id: 'gone', field: 'title', value: 'x' },
    ]);
    expect(absent.inverse).toEqual([]);
    const empty = applyPatches({ stickies: {}, frames: { a: frame('a') } }, [
      { op: 'frame:delete', id: 'a' },
    ]);
    expect(empty.board).toEqual(boardOf());
    const replaced = applyPatches(source, [
      { op: 'frame:add', frame: frame('root', { title: '교체' }) },
    ]);
    expect(applyPatches(replaced.board, replaced.inverse).board).toEqual(source);
    expect(
      applyPatches(source, [{ op: 'frame:set', id: 'root', field: 'title', value: '프레임 1' }])
        .board,
    ).toBe(source);
  });
});
