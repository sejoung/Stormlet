import { describe, expect, it } from 'vitest';
import {
  BESIDE_GAP,
  SECTION_GAP,
  layoutDraft,
  type DraftFrame,
  type DraftSticky,
} from '../../../../src/domain/layout/auto-layout';
import { freeSpot } from '../../../../src/domain/layout/free-spot';
import { contains, type Frame } from '../../../../src/domain/frames/model';
import type { Sticky } from '../../../../src/domain/model';

const note = (id: string, extra: Partial<DraftSticky> = {}): DraftSticky => ({
  id,
  kind: null,
  color: 'yellow',
  text: id,
  width: 160,
  height: 120,
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

describe('editing a laid-out board (ADR 0019)', () => {
  it('adds a note to a positioned frame below what it holds, growing the frame', () => {
    const box = frame('f', { x: 0, y: 0, width: 400, height: 240 });
    const old = note('old', { x: 40, y: 40, z: 0 });
    const { stickies, frames } = layoutDraft([old, note('new', { frame: 'f' })], [box]);
    const at = byId(stickies);
    const grown = frames[0] as Frame;
    expect(at.old).toMatchObject({ x: 40, y: 40 });
    expect(at.new.y).toBeGreaterThanOrEqual(at.old.y + at.old.height);
    expect(overlaps(at.old, at.new)).toBe(false);
    expect(contains(grown, at.new)).toBe(true);
    expect(grown).toMatchObject({ x: 0, y: 0, width: 400 });
  });

  it('puts a new note beside the positioned note its line comes from', () => {
    const { stickies } = layoutDraft(
      [note('api', { x: 0, y: 0, z: 0 }), note('cache')],
      [],
      [{ from: 'api', to: 'cache' }],
    );
    const at = byId(stickies);
    expect(at.cache).toMatchObject({ x: 160 + BESIDE_GAP, y: 0 });
  });

  it('puts a new note before the positioned note its line goes to', () => {
    const { stickies } = layoutDraft(
      [note('db', { x: 1000, y: 0, z: 0 }), note('client')],
      [],
      [{ from: 'client', to: 'db' }],
    );
    expect(byId(stickies).client.x).toBe(1000 - BESIDE_GAP - 160);
  });

  it('keeps new neighbours apart and out of frames they do not belong to', () => {
    const { stickies, frames } = layoutDraft(
      [note('api', { x: 0, y: 0, z: 0 }), note('one'), note('two')],
      [frame('other', { x: 200, y: -200, width: 400, height: 600 })],
      [
        { from: 'api', to: 'one' },
        { from: 'api', to: 'two' },
      ],
    );
    const at = byId(stickies);
    expect(overlaps(at.one, at.two)).toBe(false);
    for (const id of ['one', 'two']) expect(contains(frames[0], at[id])).toBe(false);
    for (const id of ['one', 'two']) expect(overlaps(at.api, at[id])).toBe(false);
  });

  it('still puts an unlinked new note below everything', () => {
    const { stickies } = layoutDraft([note('old', { x: 0, y: 0, z: 0 }), note('new')], []);
    expect(byId(stickies).new.y).toBe(120 + SECTION_GAP);
  });

  it('takes the nearest free side of whatever covers the target', () => {
    const taken = [{ x: 0, y: 0, width: 100, height: 100 }];
    expect(freeSpot({ width: 50, height: 50 }, { x: 0, y: 0 }, taken, 10)).toEqual({
      x: -60,
      y: 0,
    });
    expect(freeSpot({ width: 50, height: 50 }, { x: 300, y: 0 }, taken, 10)).toEqual({
      x: 300,
      y: 0,
    });
  });
});
