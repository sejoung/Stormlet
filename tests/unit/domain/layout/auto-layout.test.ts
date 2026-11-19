import { describe, expect, it } from 'vitest';
import {
  FRAME_PADDING,
  LAYOUT_ORIGIN,
  SECTION_GAP,
  layoutDraft,
  type DraftFrame,
  type DraftSticky,
} from '../../../../src/domain/layout/auto-layout';
import { contains, type Frame } from '../../../../src/domain/frames/model';
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

describe('draft layout', () => {
  it('keeps positioned objects exactly where the file put them', () => {
    const placed = note('a', { x: 300, y: -20, z: 4 });
    const box = frame('f', { x: 0, y: 0, width: 640, height: 400 });
    const result = layoutDraft([placed], [box]);
    expect(result.stickies).toEqual([placed]);
    expect(result.frames).toEqual([box]);
  });

  it('places notes inside the frame they name, without overlapping', () => {
    const notes = ['a', 'b', 'c', 'd', 'e'].map((id) => note(id, { frame: 'f' }));
    const { stickies, frames } = layoutDraft(notes, [frame('f')]);
    const [box] = frames;
    for (const item of stickies) expect(contains(box, item)).toBe(true);
    for (const a of stickies)
      for (const b of stickies) if (a !== b) expect(overlaps(a, b)).toBe(false);
    expect(stickies[0]).toMatchObject({
      x: box.x + FRAME_PADDING,
      y: box.y + FRAME_PADDING,
    });
    expect(stickies.every((item) => !('frame' in item))).toBe(true);
  });

  it('lines frames up in a row that shares the tallest height', () => {
    const { frames } = layoutDraft(
      [note('a', { frame: 'one' }), note('b', { frame: 'two' }), note('c', { frame: 'two' })],
      [frame('one'), frame('two', { layout: 'column' })],
    );
    const [one, two] = frames;
    expect(one.y).toBe(two.y);
    expect(one.height).toBe(two.height);
    expect(two.x).toBeGreaterThan(one.x + one.width);
  });

  it('arranges a row frame left to right and a column frame top to bottom', () => {
    const notes = [
      note('r1', { frame: 'row' }),
      note('r2', { frame: 'row' }),
      note('c1', { frame: 'column' }),
      note('c2', { frame: 'column' }),
    ];
    const { stickies } = layoutDraft(notes, [
      frame('row', { layout: 'row' }),
      frame('column', { layout: 'column' }),
    ]);
    const at = byId(stickies);
    expect(at.r1.y).toBe(at.r2.y);
    expect(at.r2.x).toBeGreaterThan(at.r1.x);
    expect(at.c1.x).toBe(at.c2.x);
    expect(at.c2.y).toBeGreaterThan(at.c1.y);
  });

  it('puts loose text above the frames and loose notes below them', () => {
    const { stickies, frames } = layoutDraft(
      [
        note('heading', { objectType: 'text', width: 320, height: 100 }),
        note('inside', { frame: 'f' }),
        note('loose'),
      ],
      [frame('f')],
    );
    const at = byId(stickies);
    const [box] = frames;
    expect(at.heading).toMatchObject(LAYOUT_ORIGIN);
    expect(box.y).toBe(at.heading.y + at.heading.height + SECTION_GAP);
    expect(at.loose.y).toBe(box.y + box.height + SECTION_GAP);
  });

  it('starts below what the file already positioned', () => {
    const { stickies } = layoutDraft([note('old', { x: 0, y: 0, z: 0 }), note('new')], []);
    expect(byId(stickies).new.y).toBe(160 + SECTION_GAP);
  });

  it('stacks unordered notes above the highest given order, in file order', () => {
    const { stickies } = layoutDraft([note('a'), note('b', { x: 0, y: 0, z: 7 }), note('c')], []);
    expect(stickies.map((item) => item.z)).toEqual([8, 7, 9]);
  });

  it('grows a positioned frame to fit the notes placed into it', () => {
    const notes = ['a', 'b', 'c', 'd'].map((id) => note(id, { frame: 'f' }));
    const box = frame('f', { x: 100, y: 100, width: 160, height: 120 });
    const result = layoutDraft(notes, [box]);
    const grown = result.frames[0] as Frame;
    expect(grown).toMatchObject({ x: 100, y: 100 });
    for (const item of result.stickies) expect(contains(grown, item)).toBe(true);
  });

  it('treats a note naming a missing frame as a loose note', () => {
    const { stickies } = layoutDraft([note('a', { frame: 'nowhere' })], []);
    expect(stickies[0]).toMatchObject(LAYOUT_ORIGIN);
  });

  it('opens the same draft the same way every time', () => {
    const draft = [note('a', { frame: 'f' }), note('b')];
    expect(layoutDraft(draft, [frame('f')])).toEqual(layoutDraft(draft, [frame('f')]));
  });
});
