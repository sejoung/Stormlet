import { describe, expect, it } from 'vitest';
import {
  FRAME_PADDING,
  layoutDraft,
  type DraftFrame,
  type DraftSticky,
} from '../../../../src/domain/layout/auto-layout';
import { arrange, FLOW_COLUMN_GAP } from '../../../../src/domain/layout/arrange';
import { contains } from '../../../../src/domain/frames/model';
import type { Sticky } from '../../../../src/domain/model';

const note = (id: string, extra: Partial<DraftSticky> = {}): DraftSticky => ({
  id,
  kind: null,
  color: 'yellow',
  text: id,
  width: 160,
  height: 160,
  ...extra,
});
const frame = (id: string, extra: Partial<DraftFrame> = {}): DraftFrame => ({
  id,
  title: id,
  color: 'none',
  borderWidth: 2,
  locked: false,
  ...extra,
});
const byId = <T extends { id: string }>(items: T[]) =>
  Object.fromEntries(items.map((item) => [item.id, item]));
const overlaps = (a: Sticky, b: Sticky) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const box = (key: string) => ({ key, width: 100, height: 100 });

describe('flow arrangement (ADR 0018)', () => {
  it('puts each box one column right of the boxes linked to it', () => {
    const { at } = arrange([box('c'), box('a'), box('b')], 'flow', [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'a', to: 'c' },
    ]);
    expect(at.get('a')!.x).toBe(0);
    expect(at.get('b')!.x).toBe(100 + FLOW_COLUMN_GAP);
    expect(at.get('c')!.x).toBe(2 * (100 + FLOW_COLUMN_GAP));
  });

  it('ignores the line that closes a cycle instead of failing', () => {
    const { at } = arrange([box('a'), box('b')], 'flow', [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a' },
    ]);
    expect(at.get('a')!.x).toBeLessThan(at.get('b')!.x);
  });

  it('orders a column by the rows its sources sit in', () => {
    const { at } = arrange([box('top'), box('bottom'), box('second'), box('first')], 'flow', [
      { from: 'top', to: 'first' },
      { from: 'bottom', to: 'second' },
    ]);
    expect(at.get('first')!.y).toBeLessThan(at.get('second')!.y);
  });

  it('centres shorter columns on the tallest one', () => {
    const { at, size } = arrange([box('a'), box('b'), box('c')], 'flow', [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c' },
    ]);
    expect(at.get('a')!.y + 50).toBe(size.height / 2);
  });
});

describe('nested frames and flows in drafts', () => {
  it('lays a frame out inside the frame it names, and its notes inside it', () => {
    const { stickies, frames } = layoutDraft(
      [note('api', { frame: 'private' }), note('lb', { frame: 'vpc' })],
      [frame('vpc'), frame('private', { frame: 'vpc' })],
    );
    const at = byId(frames);
    const notes = byId(stickies);
    expect(contains(at.vpc, at.private)).toBe(true);
    expect(contains(at.private, notes.api)).toBe(true);
    expect(contains(at.vpc, notes.lb)).toBe(true);
    expect(contains(at.private, notes.lb)).toBe(false);
  });

  it('follows lines between frames on a flow board, from the user to the database', () => {
    const notes = [
      note('user'),
      note('api', { frame: 'app' }),
      note('db', { frame: 'data' }),
      note('cache', { frame: 'data' }),
    ];
    const { stickies, frames } = layoutDraft(
      notes,
      [frame('app'), frame('data', { layout: 'column' })],
      [
        { from: 'user', to: 'api' },
        { from: 'api', to: 'db' },
        { from: 'api', to: 'cache' },
      ],
      'flow',
    );
    const at = byId(stickies);
    const box = byId(frames);
    expect(at.user.x + at.user.width).toBeLessThan(box.app.x);
    expect(box.app.x + box.app.width).toBeLessThan(box.data.x);
    for (const a of stickies)
      for (const b of stickies) if (a !== b) expect(overlaps(a, b)).toBe(false);
  });

  it('flows inside a frame by the lines between its notes', () => {
    const { stickies, frames } = layoutDraft(
      [note('b', { frame: 'f' }), note('a', { frame: 'f' })],
      [frame('f', { layout: 'flow' })],
      [{ from: 'a', to: 'b' }],
    );
    const at = byId(stickies);
    expect(at.a.x).toBe(frames[0].x + FRAME_PADDING);
    expect(at.b.x).toBeGreaterThan(at.a.x + at.a.width);
  });

  it('places a frame on the board when its parent is missing or the hints form a cycle', () => {
    const { frames } = layoutDraft(
      [],
      [frame('a', { frame: 'b' }), frame('b', { frame: 'a' }), frame('c', { frame: 'gone' })],
    );
    const at = byId(frames);
    expect(contains(at.a, at.b) || contains(at.b, at.a)).toBe(false);
    expect(at.c.y).toBe(at.a.y);
  });

  it('nests a draft frame inside a positioned frame, which grows to hold it', () => {
    const { frames } = layoutDraft(
      [note('n', { frame: 'inner' })],
      [frame('outer', { x: 0, y: 0, width: 160, height: 120 }), frame('inner', { frame: 'outer' })],
    );
    const at = byId(frames);
    expect(at.outer).toMatchObject({ x: 0, y: 0 });
    expect(contains(at.outer, at.inner)).toBe(true);
  });
});
