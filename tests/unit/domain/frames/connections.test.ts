import { describe, expect, it } from 'vitest';
import { addConnection, updateConnection } from '../../../../src/domain/connections/commands';
import { endpointLabel } from '../../../../src/domain/connections/endpoints';
import {
  deleteFrame,
  moveFrame,
  updateFrame,
  frameContents,
  cloneFrameContents,
  cutFrameContents,
} from '../../../../src/domain/frames/commands';
import { applyPatches } from '../../../../src/domain/patch';
import {
  endpointAnchor,
  endpointCenter,
  connectionGeometry,
} from '../../../../src/engine/connections/geometry';
import { snapEndpoint } from '../../../../src/engine/connections/snapping';
import { frame } from '../../../support/frames';
import { boardOf, sticky } from '../../../support/boards';
import { connection } from '../../../support/connections';

const board = () => ({
  ...boardOf(sticky('a', { x: 80, y: 80 }), sticky('outside', { x: 1000 })),
  frames: { f: frame('f'), next: frame('next', { x: 900, y: 500 }) },
});

describe('connections attached to frames', () => {
  it('connects a frame to notes and frames but refuses dangling or self endpoints', () => {
    const source = board();
    const linked = applyPatches(
      source,
      addConnection(
        source,
        'line',
        { frameId: 'f', side: 'right' },
        { frameId: 'next', side: 'left' },
      ),
    ).board;
    expect(linked.connections?.line).toBeDefined();
    expect(endpointCenter(linked, { frameId: 'f', side: 'auto' })).toEqual({ x: 320, y: 200 });
    expect(
      endpointAnchor(linked, { frameId: 'f', side: 'right' }, { x: 1000, y: 200 }),
    ).toMatchObject({ x: 646, y: 200 });
    expect(endpointCenter(linked, { frameId: 'gone', side: 'auto' })).toBeNull();
    expect(endpointLabel(linked, { frameId: 'f', side: 'auto' }, '')).toBe('프레임 1');
    expect(endpointLabel(linked, { frameId: 'missing', side: 'auto' }, '')).toBe('프레임');
    expect(
      addConnection(source, 'bad', { frameId: 'f', side: 'right' }, { frameId: 'f', side: 'left' }),
    ).toEqual([]);
    expect(
      addConnection(
        source,
        'bad',
        { frameId: 'gone', side: 'right' },
        { stickyId: 'a', side: 'auto' },
      ),
    ).toEqual([]);
    expect(updateConnection(linked, 'line', { to: { frameId: 'f', side: 'left' } })).toEqual([]);
    expect(
      applyPatches(
        linked,
        updateConnection(linked, 'line', { to: { stickyId: 'a', side: 'auto' } }),
      ).board.connections?.line.to,
    ).toEqual({ stickyId: 'a', side: 'auto' });
  });
  it('keeps external connections attached during frame moves and resizing and deletes only incident edges', () => {
    const source = {
      ...board(),
      connections: {
        external: connection('external', {
          from: { frameId: 'f', side: 'right' },
          to: { stickyId: 'outside', side: 'left' },
        }),
        internal: connection('internal', {
          from: { frameId: 'f', side: 'bottom' },
          to: { stickyId: 'a', side: 'auto' },
        }),
        note: connection('note', {
          from: { stickyId: 'a', side: 'auto' },
          to: { stickyId: 'outside', side: 'auto' },
        }),
      },
    };
    const moved = applyPatches(source, moveFrame(source, 'f', 100, 50)).board;
    expect(connectionGeometry(moved, moved.connections!.external)!.from).toMatchObject({
      x: 746,
      y: 250,
    });
    expect(moved.stickies.outside).toEqual(source.stickies.outside);
    const resized = applyPatches(
      moved,
      updateFrame(moved, 'f', { width: 800, borderWidth: 8 }),
    ).board;
    expect(connectionGeometry(resized, resized.connections!.external)!.from.x).toBe(906);
    expect(updateFrame(source, 'f', { borderWidth: 5 })).toEqual([]);
    const deleted = applyPatches(source, deleteFrame(source, 'f'));
    expect(Object.keys(deleted.board.connections!)).toEqual(['note']);
    expect(deleted.board.stickies).toBe(source.stickies);
    expect(applyPatches(deleted.board, deleted.inverse).board).toEqual(source);
    const cut = applyPatches(source, cutFrameContents(source, 'f'));
    expect(cut.board.connections).toBeUndefined();
    expect(applyPatches(cut.board, cut.inverse).board).toEqual(source);
  });
  it('copies and remaps frame endpoints while omitting edges to objects outside the copied frame', () => {
    const source = {
      ...board(),
      connections: {
        internal: connection('internal', {
          from: { frameId: 'f', side: 'bottom' },
          to: { stickyId: 'a', side: 'top' },
        }),
        external: connection('external', {
          from: { frameId: 'f', side: 'right' },
          to: { frameId: 'next', side: 'left' },
        }),
      },
    };
    const contents = frameContents(source, 'f');
    expect(Object.keys(contents.connections!)).toEqual(['internal']);
    let id = 0;
    const copied = cloneFrameContents(contents, source, () => `copy${++id}`, 100, 100);
    const result = applyPatches(source, copied.patches).board;
    const copiedLine = Object.values(result.connections!).find(
      (line) => !source.connections[line.id as keyof typeof source.connections],
    )!;
    expect(copiedLine.from).toEqual({ frameId: copied.frameIds.get('f'), side: 'bottom' });
    expect(copiedLine.to).toEqual({ stickyId: 'copy2', side: 'top' });
  });
  it('snaps only to frame borders, prioritizes notes and supports detaching to a free point', () => {
    const source = board();
    expect(snapEndpoint(source, { x: 650, y: 200 }, 1)).toEqual({ frameId: 'f', side: 'auto' });
    expect(snapEndpoint(source, { x: 650, y: 200 }, 3)).toEqual({ x: 650, y: 200 });
    expect(snapEndpoint(source, { x: 400, y: 200 }, 1)).toEqual({ x: 400, y: 200 });
    expect(snapEndpoint(source, { x: 80, y: 80 }, 1)).toEqual({ stickyId: 'a', side: 'auto' });
    expect(snapEndpoint(source, { x: 640, y: 200 }, 1, true)).toEqual({ x: 640, y: 200 });
  });
});
