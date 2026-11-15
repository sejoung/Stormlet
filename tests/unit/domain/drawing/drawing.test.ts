import { drawingNote, inkPath } from '../../../../src/domain/drawing/geometry';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PEN } from '../../../../src/domain/drawing/model';
import { styleDrawings } from '../../../../src/domain/drawing/commands';
import { addSticky, deleteStickies, placeStickies } from '../../../../src/domain/commands';
import { applyPatches, diffBoards } from '../../../../src/domain/patch';
import { parseBoard, serializeBoard } from '../../../../src/adapters/files/stormlet-format';
import { mergeBoards } from '../../../../src/domain/sync/merge';
import { boardSvg } from '../../../../src/components/export/board-svg';
import { edit, startSession, undo, redo } from '../../../../src/application/session';
import { cloneNotes } from '../../../../src/domain/note-actions';

const note = () =>
  drawingNote(
    'ink',
    [
      { x: -100, y: 20 },
      { x: 50, y: 200 },
      { x: 200, y: 80 },
    ],
    DEFAULT_PEN,
  );
const board = () => ({ stickies: { ink: note() } });

describe('pen drawings', () => {
  it('stores tiny dots, vertical lines and large strokes without stretching or truncating them', () => {
    for (const points of [
      [{ x: 20, y: 30 }],
      [
        { x: 20, y: 30 },
        { x: 20, y: 4000 },
      ],
    ]) {
      const ink = drawingNote('ink', points, DEFAULT_PEN);
      expect(
        ink.ink?.map((p) => ({ x: p.x * ink.width + ink.x, y: p.y * ink.height + ink.y })),
      ).toEqual(points);
      expect(parseBoard(serializeBoard({ stickies: { ink } }))).toEqual({ stickies: { ink } });
      expect(inkPath(ink)).not.toContain('NaN');
    }
  });

  it('round-trips ink and style and refuses drawings in older file versions', () => {
    const content = serializeBoard(board());
    expect(parseBoard(content)).toEqual(board());
    const file = JSON.parse(content);
    file.version = 10;
    expect(() => parseBoard(JSON.stringify(file))).toThrow();
  });

  it.each([
    { ink: [] },
    { ink: null },
    { ink: [{ x: -1, y: 0 }] },
    { ink: [{ x: 0, y: 2 }] },
    { ink: [{ x: '0', y: 0 }] },
    { strokeColor: 'url(javascript:bad)' },
    { strokeColor: '#fff' },
    { strokeWidth: 0 },
    { strokeWidth: 17 },
  ])('rejects malformed ink %j', (fields) => {
    const file = JSON.parse(serializeBoard(board()));
    Object.assign(file.stickies[0], fields);
    expect(() => parseBoard(JSON.stringify(file))).toThrow();
  });

  it('records one gesture in one undo step, and restores styled deleted ink', () => {
    let session = edit(startSession({ stickies: {} }), addSticky({ stickies: {} }, note())).session;
    expect(Object.keys(undo(session).session.board.stickies)).toHaveLength(0);
    session = redo(undo(session).session).session;
    session = edit(
      session,
      styleDrawings(session.board, ['ink'], { strokeColor: '#e5484d', strokeWidth: 8 }),
    ).session;
    const styled = session.board;
    session = edit(session, deleteStickies(session.board, ['ink'])).session;
    expect(undo(session).session.board).toEqual(styled);
  });

  it('keeps relative ink when moving, resizing, cloning and applying field diffs', () => {
    const original = board();
    const patches = placeStickies(original, [
      { id: 'ink', x: 500, y: 400, width: 600, height: 360 },
    ]);
    const resized = applyPatches(original, patches).board;
    expect(resized.stickies.ink.ink).toEqual(original.stickies.ink.ink);
    expect(inkPath(resized.stickies.ink)).not.toEqual(inkPath(original.stickies.ink));
    const cloned = applyPatches(
      resized,
      cloneNotes(resized, [resized.stickies.ink], () => 'copy', 20, 30).patches,
    ).board;
    expect(cloned.stickies.copy).toMatchObject({
      objectType: 'drawing',
      x: 520,
      y: 430,
      ink: note().ink,
    });
    const diff = diffBoards(original, cloned);
    const applied = applyPatches(original, diff);
    expect(applied.board).toEqual(cloned);
    expect(applyPatches(cloned, applied.inverse).board).toEqual(original);
  });

  it('merges movement and color edits independently and honors locks', () => {
    const original = board();
    const local = applyPatches(
      original,
      styleDrawings(original, ['ink'], { strokeColor: '#e5484d' }),
    ).board;
    const remote = { stickies: { ink: { ...note(), x: 400, y: 300 } } };
    const merged = mergeBoards(original, local, remote);
    expect(merged.conflicts).toEqual([]);
    expect(merged.board.stickies.ink).toMatchObject({ x: 400, y: 300, strokeColor: '#e5484d' });
    expect(
      styleDrawings({ stickies: { ink: { ...note(), locked: true } } }, ['ink'], {
        strokeWidth: 8,
      }),
    ).toEqual([]);
  });

  it('exports the same smooth ink with its color and width, without note paper', () => {
    const image = boardSvg(board(), (text) => text.length * 8)!;
    expect(image.svg).toContain(`d="${inkPath(note())}"`);
    expect(image.svg).toContain('stroke="#232436" stroke-width="3"');
    expect(image.svg).not.toContain('filter="url(#note-shadow)"');
    expect(image.width).toBeGreaterThan(note().width);
  });
});
