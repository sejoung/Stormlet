import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { skillFiles, skillPrompt, zip } from '../../../scripts/skill-bundle';

/** The entries of a zip, read back through its central directory. */
function unzip(archive: Buffer) {
  const end = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = archive.readUInt16LE(end + 10);
  let at = archive.readUInt32LE(end + 16);
  const entries: { path: string; content: Buffer }[] = [];
  for (let i = 0; i < count; i++) {
    expect(archive.readUInt32LE(at)).toBe(0x02014b50);
    const size = archive.readUInt32LE(at + 20);
    const nameLength = archive.readUInt16LE(at + 28);
    const offset = archive.readUInt32LE(at + 42);
    const path = archive.toString('utf8', at + 46, at + 46 + nameLength);
    const start = offset + 30 + archive.readUInt16LE(offset + 26);
    entries.push({ path, content: inflateRawSync(archive.subarray(start, start + size)) });
    at += 46 + nameLength;
  }
  return entries;
}

describe('skill downloads', () => {
  it('zips the skill folder as one top-level folder with SKILL.md', () => {
    const files = skillFiles();
    const entries = unzip(zip(files));
    expect(entries.map((entry) => entry.path)).toContain('stormlet/SKILL.md');
    expect(entries.every((entry) => entry.path.startsWith('stormlet/'))).toBe(true);
    for (const entry of entries)
      expect(entry.content.equals(readFileSync(`skills/${entry.path}`))).toBe(true);
  });

  it('builds the same archive every time', () => {
    expect(zip(skillFiles()).equals(zip(skillFiles()))).toBe(true);
  });

  it('turns the skill into one prompt without its frontmatter', () => {
    const prompt = skillPrompt();
    expect(prompt).not.toMatch(/^---/m);
    expect(prompt).toContain('# Stormlet boards');
    expect(prompt).toContain('# The .stormlet format');
    expect(prompt).toContain('# Architecture boards');
    expect(prompt).toContain('"format": "stormlet"');
  });
});
