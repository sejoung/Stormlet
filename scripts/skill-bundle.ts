import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';
import type { Plugin } from 'vite';

/**
 * The AI skill (skills/stormlet, ADR 0017) as the site serves it: a zip to upload to
 * claude.ai or ChatGPT, and the same instructions as one prompt for chats without skills.
 * Both are built from the skill folder, so there is a single source to keep up to date.
 */
export const SKILL_DIR = 'skills/stormlet';
export const SKILL_ZIP = 'skill/stormlet-skill.zip';
export const SKILL_PROMPT = 'skill/stormlet-prompt.md';

/** Every file of the skill, by its path inside the zip (`stormlet/SKILL.md`, …), sorted. */
export function skillFiles(dir = SKILL_DIR): { path: string; content: Buffer }[] {
  const walk = (folder: string): string[] =>
    readdirSync(folder, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith('.'))
      .flatMap((entry) =>
        entry.isDirectory() ? walk(join(folder, entry.name)) : [join(folder, entry.name)],
      );
  return walk(dir)
    .map((file) => ({
      path: `stormlet/${relative(dir, file).split('\\').join('/')}`,
      content: readFileSync(file),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * A zip archive of `files`, deflated. Timestamps are fixed at 1980-01-01, the earliest a
 * zip can hold, so the same skill always builds the same bytes.
 */
export function zip(files: readonly { path: string; content: Buffer }[]): Buffer {
  const DOS_DATE = (0 << 9) | (1 << 5) | 1;
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const { path, content } of files) {
    const name = Buffer.from(path, 'utf8');
    const data = deflateRawSync(content);
    const crc = crc32(content);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(0x0800, 6); // UTF-8 names
    header.writeUInt16LE(8, 8); // deflate
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(DOS_DATE, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(content.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4); // made by
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(0, 12);
    entry.writeUInt16LE(DOS_DATE, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(content.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    local.push(header, name, data);
    central.push(entry, name);
    offset += header.length + name.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

/**
 * The skill as one prompt to paste into a chat: the instructions without their
 * frontmatter, then the format reference and one example.
 */
export function skillPrompt(dir = SKILL_DIR): string {
  const read = (path: string) => readFileSync(join(dir, path), 'utf8').trim();
  const instructions = read('SKILL.md').replace(/^---\n[\s\S]*?\n---\n/, '');
  return [
    '<!-- Paste this whole text into a chat, then ask for the board you want. -->',
    instructions.trim(),
    read('references/format.md'),
    '## Example: examples/kpt.stormlet',
    ['```json', read('examples/kpt.stormlet'), '```'].join('\n'),
    '',
  ].join('\n\n');
}

const assets = (): Record<string, { type: string; body: Buffer }> => ({
  [SKILL_ZIP]: { type: 'application/zip', body: zip(skillFiles()) },
  [SKILL_PROMPT]: { type: 'text/markdown; charset=utf-8', body: Buffer.from(skillPrompt()) },
});

/** Adds the skill downloads to the build, and serves them from the dev server. */
export function skillBundle(): Plugin {
  return {
    name: 'stormlet-skill-bundle',
    buildStart() {
      this.addWatchFile(join(SKILL_DIR, 'SKILL.md'));
    },
    generateBundle() {
      for (const [fileName, { body }] of Object.entries(assets()))
        this.emitFile({ type: 'asset', fileName, source: body });
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const asset = assets()[(request.url ?? '').replace(/^\//, '').split('?')[0]];
        if (!asset) return next();
        response.setHeader('Content-Type', asset.type);
        response.end(asset.body);
      });
    },
  };
}
