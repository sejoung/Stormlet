import { describe, expect, it } from 'vitest';
import { parseBoard, serializeBoard } from '../../../../src/adapters/files/stormlet-format';
import { boardOf, sticky } from '../../../support/boards';
import { diffBoards, applyPatches } from '../../../../src/domain/patch';
import { cloneNotes, sameColorIds } from '../../../../src/domain/note-actions';
import { mergeBoards } from '../../../../src/domain/sync/merge';

const text = (id = 'a') =>
  sticky(id, {
    objectType: 'text',
    text: '제목\n설명 <script>',
    color: 'yellow',
    kind: null,
    textColor: 'blue',
    fontSize: 24,
    autoFont: false,
    textAlign: 'left',
  });

describe('standalone text persistence and shared commands', () => {
  it('round-trips text boxes smaller than note minimums without accepting undersized notes', () => {
    const board = boardOf({ ...text(), width: 20, height: 16 });
    expect(parseBoard(serializeBoard(board))).toEqual(board);
    const file = JSON.parse(serializeBoard(board));
    delete file.stickies[0].objectType;
    expect(() => parseBoard(JSON.stringify(file))).toThrow();
  });
  it('round-trips text and mixed boards without changing older notes', () => {
    const board = boardOf(text(), sticky('b'));
    const serialized = serializeBoard(board);
    expect(JSON.parse(serialized).version).toBe(10);
    expect(parseBoard(serialized)).toEqual(board);
    const legacy = JSON.parse(serializeBoard(boardOf(sticky('old'))));
    legacy.version = 9;
    expect(parseBoard(JSON.stringify(legacy)).stickies.old.objectType).toBeUndefined();
  });

  it.each([
    { objectType: 'html' },
    { objectType: null },
    { textColor: 'url(javascript:bad)' },
    { textColor: '#fff' },
    { textColor: null },
  ])('rejects malformed text fields %j', (fields) => {
    const file = JSON.parse(serializeBoard(boardOf(text())));
    Object.assign(file.stickies[0], fields);
    expect(() => parseBoard(JSON.stringify(file))).toThrow();
  });

  it('tracks text type and color in field patches and their inverses', () => {
    const before = boardOf(sticky('a'));
    const after = boardOf(text());
    const patches = diffBoards(before, after);
    expect(patches).toContainEqual({ op: 'set', id: 'a', field: 'objectType', value: 'text' });
    const applied = applyPatches(before, patches);
    expect(applied.board).toEqual(after);
    expect(applyPatches(applied.board, applied.inverse).board).toEqual(before);
  });

  it('keeps text identity and formatting when cloning', () => {
    const original = text();
    const board = boardOf(original);
    const copy = cloneNotes(board, [original], () => 'copy', 40, 60);
    const saved = applyPatches(board, copy.patches).board;
    expect(saved.stickies.copy).toMatchObject({
      ...original,
      id: 'copy',
      x: original.x + 40,
      y: original.y + 60,
      z: 2,
    });
  });

  it('merges edits to text and text color independently', () => {
    const base = boardOf(text());
    const local = boardOf({ ...text(), text: '새 제목' });
    const remote = boardOf({ ...text(), textColor: 'red' });
    const merged = mergeBoards(base, local, remote);
    expect(merged.conflicts).toEqual([]);
    expect(merged.board.stickies.a).toMatchObject({
      objectType: 'text',
      text: '새 제목',
      textColor: 'red',
    });
  });

  it('selects text by its ink without selecting notes with the same hidden paper color', () => {
    const board = boardOf(text(), { ...text('b'), textColor: 'red' }, text('c'), sticky('note'));
    expect(sameColorIds(board, ['a'])).toEqual(['a', 'c']);
    expect(sameColorIds(board, ['note'])).toEqual(['note']);
  });
});
