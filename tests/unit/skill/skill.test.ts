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
const architecture = readFileSync(`${ROOT}/references/architecture.md`, 'utf8');
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

  it('names only icons and layouts the app has in the architecture guide', () => {
    const named = [...architecture.matchAll(/`(k8s-[a-z]+)`/g)].map((match) => match[1]);
    expect(named.length).toBeGreaterThan(5);
    for (const icon of named) expect(NOTE_ICONS).toContain(icon);
    for (const layout of architecture.matchAll(/"layout": "([a-z-]+)"/g))
      expect([...BOARD_LAYOUTS, ...FRAME_LAYOUTS]).toContain(layout[1]);
  });

  it('links every example it names', () => {
    for (const name of [skill, architecture].join('\n').matchAll(/examples\/([\w-]+\.stormlet)/g))
      expect(examples).toContain(name[1]);
  });
});

// The guide publishes its own localized files, independently of the skill bundle.
// Exercise them here so a malformed download fails before the browser suite starts.
for (const locale of ['ko', 'en']) {
  const dir = `public/manual/examples/${locale}`;
  describe(`${locale} guide downloads`, () => {
    it.each(readdirSync(dir).filter((name) => name.endsWith('.stormlet')))(
      'opens %s without dropping any notes or connections',
      (name) => {
        const text = readFileSync(`${dir}/${name}`, 'utf8');
        const raw = JSON.parse(text);
        const board = parseBoard(text);
        expect(Object.keys(board.stickies)).toHaveLength(raw.stickies.length);
        expect(Object.keys(board.connections ?? {})).toHaveLength(raw.connections?.length ?? 0);
        if (name === 'event-storming.stormlet') {
          const legend = board.frames!.notation;
          for (const frame of Object.values(board.frames!))
            if (frame.id !== legend.id) expect(frame.y).toBeGreaterThan(legend.y + legend.height);
          expect(board.stickies['key-actor'].color).toBe('yellow');
          expect(board.stickies['key-aggregate'].color).toBe('gold');
        }
      },
    );
  });
}
