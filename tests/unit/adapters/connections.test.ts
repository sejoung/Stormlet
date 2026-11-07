import { describe, expect, it } from 'vitest';
import {
  FormatError,
  parseBoard,
  serializeBoard,
} from '../../../src/adapters/files/stormlet-format';
import { connectedBoard, connection } from '../../support/connections';

const file = (connections: unknown) =>
  JSON.stringify({
    format: 'stormlet',
    version: 6,
    title: '흐름',
    stickies: Object.values(connectedBoard().stickies),
    connections,
  });

describe('connection files', () => {
  it('retains endpoints, style and labels when reopening a board', () => {
    const board = {
      ...connectedBoard(
        connection('line', {
          from: { stickyId: 'a', side: 'right' },
          to: { x: -30, y: 500 },
          label: '확인 후 진행',
          path: 'curve',
          width: 4,
          color: 'blue',
          startArrow: true,
          dashed: true,
          locked: true,
        }),
      ),
      title: '흐름',
    };
    const content = serializeBoard(board);
    expect(JSON.parse(content).version).toBe(8);
    expect(parseBoard(content)).toStrictEqual(board);
    expect(parseBoard(file(undefined)).connections).toBeUndefined();
  });

  it.each([
    null,
    {},
    [null],
    [connection(), connection()],
    [{ ...connection(), id: '__proto__' }],
    [{ ...connection(), color: 'invalid' }],
    [{ ...connection(), path: 'invalid' }],
    [{ ...connection(), width: 0 }],
    [{ ...connection(), label: 'x'.repeat(301) }],
    [{ ...connection(), locked: 'yes' }],
    [{ ...connection(), from: { stickyId: 'gone', side: 'auto' } }],
    [{ ...connection(), from: { stickyId: 'a', side: 'invalid' } }],
    [{ ...connection(), from: { x: null, y: 0 } }],
    [{ ...connection(), from: null }],
    [{ ...connection(), to: { stickyId: 'a', side: 'left' } }],
    [{ ...connection(), endArrow: 1 }],
  ])('rejects malformed or dangling connections %j', (connections) => {
    expect(() => parseBoard(file(connections))).toThrow(FormatError);
  });

  it('continues to read v5 boards and discards unknown connection properties', () => {
    const parsed = parseBoard(
      file([
        { ...connection(), unknown: '<script>', from: { stickyId: 'a', side: 'auto', unknown: 1 } },
      ]),
    );
    expect(parsed.connections?.line).not.toHaveProperty('unknown');
    expect(parsed.connections?.line.from).not.toHaveProperty('unknown');
    const old = JSON.parse(file([]));
    old.version = 5;
    delete old.connections;
    expect(parseBoard(JSON.stringify(old)).connections).toBeUndefined();
  });
});
