import { describe, expect, it } from 'vitest';
import {
  connectionGeometry,
  endpointAnchor,
  endpointCenter,
} from '../../../src/engine/connections/geometry';
import { snapEndpoint, constrainEndpoint } from '../../../src/engine/connections/snapping';
import { CONNECTION_PATHS, CONNECTION_SIDES } from '../../../src/domain/connections/model';
import { connectedBoard, connection } from '../../support/connections';
import { applyPatches } from '../../../src/domain/patch';
import { roundedPolyline } from '../../../src/engine/connections/rounded-path';

describe('connection geometry', () => {
  it('rounds elbow corners without moving endpoints or overshooting short segments', () => {
    expect(roundedPolyline([])).toBe('');
    expect(
      roundedPolyline([
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ]),
    ).toBe('M 0 0');
    expect(
      roundedPolyline(
        [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 40 },
        ],
        12,
      ),
    ).toBe('M 0 0 L 10 0 Q 20 0 20 10 L 20 40');
    expect(
      roundedPolyline([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
      ]),
    ).not.toContain(' Q ');
    const shape = connectionGeometry(connectedBoard(), connection())!;
    expect(shape.path).toContain(' Q ');
    expect(shape.path).not.toMatch(/NaN|Infinity/);
    expect(shape.path).toMatch(new RegExp(`L ${shape.to.x} ${shape.to.y}$`));
  });
  it('anchors at note boundaries and follows temporary and committed moves and resizing', () => {
    const board = connectedBoard();
    const line = connection('line', { from: { stickyId: 'a', side: 'right' } });
    const before = connectionGeometry(board, line)!;
    expect(before.from.x).toBe(166);
    const after = applyPatches(board, [
      { op: 'set', id: 'a', field: 'x', value: 100 },
      { op: 'set', id: 'a', field: 'width', value: 200 },
    ]).board;
    const moved = connectionGeometry(after, line)!;
    expect(moved.from.x).toBe(306);
    expect(connectionGeometry(after, connection())!.from.ny).toBe(1);
    expect(moved.path).not.toBe(before.path);
    expect(endpointCenter(board, { stickyId: 'gone', side: 'auto' })).toBeNull();
    expect(endpointAnchor(board, { stickyId: 'gone', side: 'auto' }, { x: 0, y: 0 })).toBeNull();
    expect(
      connectionGeometry(board, connection('bad', { to: { stickyId: 'gone', side: 'auto' } })),
    ).toBeNull();
  });

  it.each(CONNECTION_PATHS)(
    'routes %s lines for every port orientation without invalid coordinates',
    (path) => {
      const board = connectedBoard();
      for (const from of CONNECTION_SIDES)
        for (const to of CONNECTION_SIDES) {
          const shape = connectionGeometry(
            board,
            connection('line', {
              path,
              from: { stickyId: 'a', side: from },
              to: { stickyId: 'b', side: to },
            }),
          )!;
          expect(shape.path).toMatch(/^M /);
          expect(shape.path).not.toMatch(/NaN|undefined|Infinity/);
          expect(shape.bounds.width).toBeGreaterThan(0);
          expect(Number.isFinite(shape.label.y)).toBe(true);
        }
      expect(
        connectionGeometry(
          board,
          connection('free', { path, from: { x: 0, y: 0 }, to: { x: 0, y: -100 } }),
        )!.path,
      ).not.toContain('NaN');
      expect(
        connectionGeometry(
          board,
          connection('reverse', {
            path,
            from: { stickyId: 'b', side: 'auto' },
            to: { stickyId: 'a', side: 'auto' },
          }),
        )!.from.nx,
      ).toBe(-1);
      expect(
        connectionGeometry(
          board,
          connection('same', { path, from: { x: 0, y: 0 }, to: { x: 0, y: 0 } }),
        )!.label.x,
      ).toBe(0);
    },
  );

  it('snaps to visible note boundaries in screen pixels and supports free or Shift-constrained endpoints', () => {
    const board = connectedBoard();
    expect(snapEndpoint(board, { x: 170, y: 50 }, 1)).toEqual({ stickyId: 'a', side: 'auto' });
    expect(snapEndpoint(board, { x: 170, y: 50 }, 3)).toEqual({ x: 170, y: 50 });
    expect(snapEndpoint(board, { x: 80, y: 60 }, 1, true)).toEqual({ x: 80, y: 60 });
    expect(constrainEndpoint({ x: 0, y: 0 }, { x: 100, y: 10 }).y).toBe(0);
    const diagonal = constrainEndpoint({ x: 0, y: 0 }, { x: 100, y: 80 });
    expect(diagonal.x).toBeCloseTo(diagonal.y);
  });
});
