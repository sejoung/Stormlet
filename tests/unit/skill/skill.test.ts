import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FORMAT_VERSION, parseBoard } from '../../../src/adapters/files/stormlet-format';
import { STICKY_COLORS, type Sticky } from '../../../src/domain/model';
import { FRAME_COLORS, contains } from '../../../src/domain/frames/model';
import { CONNECTION_COLORS, CONNECTION_PATHS } from '../../../src/domain/connections/model';
import { BOARD_LAYOUTS, FRAME_LAYOUTS } from '../../../src/domain/layout/auto-layout';
import { NOTE_ICONS } from '../../../src/domain/note-details';

/**
 * The AI skill (skills/stormlet, ADR 0017) teaches the file format from text. These checks
 * keep that text and its examples in step with the code, so a format change cannot leave
 * agents writing files the app refuses.
 */
const ROOT = 'skills/stormlet';
const skill = readFileSync(`${ROOT}/SKILL.md`, 'utf8');
const reference = readFileSync(`${ROOT}/references/format.md`, 'utf8');
const examples = readdirSync(`${ROOT}/examples`).filter((name) => name.endsWith('.stormlet'));

const frontmatter = (text: string) =>
  Object.fromEntries(
    text
      .split('---')[1]
      .trim()
      .split('\n')
      .map((line) => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1).trim()]),
  );
const overlaps = (a: Sticky, b: Sticky) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
/** Backticked words on the line of SKILL.md that starts with `label`. */
const listed = (label: string) =>
  [...(skill.split('\n').find((line) => line.includes(label)) ?? '').matchAll(/`([\w-]+)`/g)].map(
    (match) => match[1],
  );

describe('Stormlet skill', () => {
  it('has the frontmatter the Agent Skills standard requires', () => {
    const { name, description } = frontmatter(skill);
    expect(name).toBe('stormlet');
    expect(name).toMatch(/^[a-z0-9-]{1,64}$/);
    expect(description.length).toBeGreaterThan(0);
    expect(description.length).toBeLessThanOrEqual(1024);
  });

  it('teaches the version this build writes and reads', () => {
    expect(skill).toContain(`"version": ${FORMAT_VERSION}`);
    expect(reference).toContain(`"version": ${FORMAT_VERSION}`);
  });

  it('lists exactly the values the app accepts', () => {
    expect(new Set(listed('**Note colors**'))).toEqual(new Set(STICKY_COLORS));
    expect(listed('**Note icons**')).toEqual([...NOTE_ICONS]);
    expect(listed('**Board layout**')).toEqual(
      expect.arrayContaining(BOARD_LAYOUTS.filter((layout) => layout !== 'board')),
    );
    for (const icon of NOTE_ICONS) expect(reference).toContain(`\`${icon}\``);
    expect(listed('**Frame** (`frames[]`)')).toEqual(
      expect.arrayContaining([...FRAME_COLORS, ...FRAME_LAYOUTS]),
    );
    expect(listed('**Line** (`connections[]`)')).toEqual(
      expect.arrayContaining([...CONNECTION_COLORS, ...CONNECTION_PATHS]),
    );
  });

  it.each(examples)('opens examples/%s as a tidy board', (name) => {
    const text = readFileSync(`${ROOT}/examples/${name}`, 'utf8');
    const file = JSON.parse(text);
    // Examples show the draft form agents should write: no coordinates.
    for (const item of [...file.stickies, ...(file.frames ?? [])]) expect(item.x).toBeUndefined();
    const board = parseBoard(text);
    const notes = Object.values(board.stickies);
    for (const raw of file.stickies.filter((note: { frame?: string }) => note.frame))
      expect(contains(board.frames![raw.frame], board.stickies[raw.id])).toBe(true);
    for (const a of notes) for (const b of notes) if (a !== b) expect(overlaps(a, b)).toBe(false);
    for (const raw of file.frames?.filter((frame: { frame?: string }) => frame.frame) ?? [])
      expect(contains(board.frames![raw.frame], board.frames![raw.id])).toBe(true);
    expect(Object.keys(board.connections ?? {})).toHaveLength(file.connections?.length ?? 0);
  });

  it('links every example it names', () => {
    for (const name of skill.matchAll(/examples\/([\w-]+\.stormlet)/g))
      expect(examples).toContain(name[1]);
  });
});
