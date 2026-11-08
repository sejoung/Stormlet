import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DriveSync,
  MAX_SYNC_WAIT,
  RETRY_DELAYS,
  SYNC_DELAY,
  type SyncState,
} from '../../../src/application/drive-sync';
import type { Patch } from '../../../src/domain/patch';
import type { Board } from '../../../src/domain/model';
import type { RemoteLink } from '../../../src/domain/sync/remote';
import { boardOf, sticky } from '../../support/boards';
import { fakeDrive, localStore, memoryLinks } from '../../support/drive';

const text = (board: Board, id: string) => board.stickies[id]?.text;
const withText = (board: Board, id: string, value: string): Board => ({
  ...board,
  stickies: { ...board.stickies, [id]: { ...(board.stickies[id] ?? sticky(id)), text: value } },
});
const setText = (id: string, value: string): Patch[] => [{ op: 'set', id, field: 'text', value }];

function setup(board?: Board, link: RemoteLink | null = null) {
  const local = localStore(board);
  const drive = fakeDrive();
  const links = memoryLinks(link);
  const sync = new DriveSync(local, drive.remote, links);
  const states: SyncState['status'][] = [];
  sync.watch((state) => states.push(state.status));
  const outside: Patch[][] = [];
  sync.subscribe((patches) => outside.push(patches));
  return { local, drive, links, sync, states, outside };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Drive sync', () => {
  it('creates a file, then saves edits once they pause and keeps the link', async () => {
    const { sync, drive, links, states, local } = setup();
    expect(sync.current).toEqual({ status: 'unlinked' });
    sync.apply(setText('a', 'not linked yet'));
    await vi.advanceTimersByTimeAsync(SYNC_DELAY * 2);
    expect(drive.calls).toEqual([]);

    const file = await sync.create('folder');
    expect(file).toEqual({ id: 'file1', name: 'board.stormlet', version: '1' });
    expect(sync.current).toEqual({ status: 'synced', file });
    // The account it is in is kept with the link.
    expect(links.link).toEqual({
      file,
      base: local.board,
      account: { id: 'me', email: 'me@example.com' },
    });

    sync.apply(setText('a', 'one'));
    sync.apply(setText('a', 'two'));
    expect(sync.current.status).toBe('pending');
    await vi.advanceTimersByTimeAsync(SYNC_DELAY - 1);
    expect(drive.calls).toEqual(['create folder']);
    await vi.advanceTimersByTimeAsync(1);
    expect(drive.calls).toEqual(['create folder', 'save file1']);
    expect(text(drive.files.get('file1')!.board, 'a')).toBe('two');
    expect(sync.current).toEqual({ status: 'synced', file: { ...file, version: '2' } });
    expect(links.link?.file.version).toBe('2');
    expect(states).toEqual(['synced', 'pending', 'saving', 'synced']);
    expect(sync.load()).toBe(local.board);
  });

  it('still saves regularly while edits never pause', async () => {
    const { sync, drive } = setup();
    await sync.create('folder');
    for (let elapsed = 0; elapsed < MAX_SYNC_WAIT; elapsed += SYNC_DELAY / 2) {
      sync.apply(setText('a', `edit ${elapsed}`));
      await vi.advanceTimersByTimeAsync(SYNC_DELAY / 2);
    }
    expect(drive.calls.filter((call) => call.startsWith('save'))).toHaveLength(1);
  });

  it('merges changes made elsewhere into the board before saving its own', async () => {
    const { sync, drive, local, outside } = setup(boardOf(sticky('a'), sticky('b')));
    await sync.create('folder');
    drive.elsewhere('file1', (board) => withText(board, 'b', 'theirs'));
    sync.apply(setText('a', 'mine'));
    await vi.advanceTimersByTimeAsync(SYNC_DELAY);
    expect(drive.calls).toEqual(['create folder', 'save file1', 'open file1', 'save file1']);
    expect(outside).toEqual([setText('b', 'theirs')]);
    expect([text(local.board, 'a'), text(local.board, 'b')]).toEqual(['mine', 'theirs']);
    const saved = drive.files.get('file1')!;
    expect([text(saved.board, 'a'), text(saved.board, 'b'), saved.version]).toEqual([
      'mine',
      'theirs',
      3,
    ]);
    expect(sync.current.status).toBe('synced');
  });

  it('waits for a choice on real conflicts and saves the chosen sides', async () => {
    const { sync, drive, local } = setup(boardOf(sticky('a'), sticky('b')));
    await sync.create('folder');
    drive.elsewhere('file1', (board) => withText(withText(board, 'a', 'theirs'), 'b', 'theirs'));
    sync.apply([...setText('a', 'mine'), ...setText('b', 'mine')]);
    await vi.advanceTimersByTimeAsync(SYNC_DELAY);
    const state = sync.current;
    expect(state.status).toBe('conflict');
    expect(state.status === 'conflict' && state.conflicts.map((c) => c.key)).toEqual([
      'stickies:a:text',
      'stickies:b:text',
    ]);
    // Edits keep coming in locally while the choice is open, without saving.
    sync.apply(setText('c', 'ignored'));
    await vi.advanceTimersByTimeAsync(SYNC_DELAY * 2);
    expect(drive.calls.at(-1)).toBe('open file1');

    await sync.resolve({ 'stickies:b:text': 'remote' });
    expect([text(local.board, 'a'), text(local.board, 'b')]).toEqual(['mine', 'theirs']);
    expect(text(drive.files.get('file1')!.board, 'a')).toBe('mine');
    expect(text(drive.files.get('file1')!.board, 'b')).toBe('theirs');
    expect(sync.current.status).toBe('synced');
    await expect(sync.resolve({})).resolves.toBeUndefined();
  });

  it('pauses a remembered file until reconnecting, then pulls and saves', async () => {
    const first = setup();
    await first.sync.create('folder');
    const link = first.links.link!;
    first.drive.elsewhere('file1', (board) => withText(board, 'b', 'added elsewhere'));

    const local = localStore(withText(link.base, 'a', 'offline edit'));
    const sync = new DriveSync(local, first.drive.remote, memoryLinks(link));
    expect(sync.current).toEqual({ status: 'paused', file: link.file });
    sync.apply(setText('a', 'more offline'));
    await vi.advanceTimersByTimeAsync(SYNC_DELAY * 2);
    expect(first.drive.calls).toEqual(['create folder']);

    await sync.resume();
    expect(first.drive.calls).toEqual([
      'create folder',
      'version file1',
      'open file1',
      'save file1',
    ]);
    expect(text(local.board, 'b')).toBe('added elsewhere');
    expect(text(first.drive.files.get('file1')!.board, 'a')).toBe('more offline');
    expect(sync.current.status).toBe('synced');
  });

  it('starts from the last synced board when the local one was lost', async () => {
    const first = setup();
    await first.sync.create('folder');
    const link = first.links.link!;
    const local = localStore(boardOf());
    const sync = new DriveSync(local, first.drive.remote, memoryLinks(link), Date.now, true);
    expect(local.board).toEqual(link.base);
    await sync.resume();
    expect(first.drive.calls).toEqual(['create folder', 'version file1']);
    expect(text(first.drive.files.get('file1')!.board, 'a')).toBe('a');
    // Without a remembered file there is nothing to restore from.
    const lone = localStore(boardOf());
    new DriveSync(lone, first.drive.remote, memoryLinks(), Date.now, true);
    expect(lone.board).toEqual(boardOf());
  });

  it('skips downloading on resume when the file did not change', async () => {
    const { sync, drive } = setup();
    await sync.create('folder');
    await sync.resume();
    expect(drive.calls).toEqual(['create folder', 'version file1']);
    expect(sync.current.status).toBe('synced');
  });

  it('pauses when access ends and stops on refusals until saved again', async () => {
    const { sync, drive } = setup();
    await sync.create('folder');
    drive.failures.push('auth');
    sync.apply(setText('a', 'x'));
    await vi.advanceTimersByTimeAsync(SYNC_DELAY);
    expect(sync.current.status).toBe('paused');

    drive.failures.push('permission');
    await sync.saveNow();
    expect(sync.current).toMatchObject({
      status: 'failed',
      reason: 'permission',
      detail: 'permission',
    });
    sync.apply(setText('a', 'y'));
    await vi.advanceTimersByTimeAsync(SYNC_DELAY * 2);
    expect(drive.calls.filter((call) => call.startsWith('save'))).toHaveLength(2);

    await sync.saveNow();
    expect(sync.current.status).toBe('synced');
    expect(text(drive.files.get('file1')!.board, 'a')).toBe('y');
  });

  it('retries network failures on a growing schedule, and on new edits', async () => {
    const { sync, drive } = setup();
    await sync.create('folder');
    drive.failures.push('network', 'network');
    sync.apply(setText('a', 'x'));
    await vi.advanceTimersByTimeAsync(SYNC_DELAY);
    expect(sync.current).toMatchObject({ status: 'failed', reason: 'network' });
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS[0]);
    expect(sync.current).toMatchObject({ status: 'failed', reason: 'network' });
    // A new edit is saved on the usual schedule even while failing.
    sync.apply(setText('a', 'z'));
    expect(sync.current.status).toBe('pending');
    await vi.advanceTimersByTimeAsync(SYNC_DELAY);
    expect(sync.current.status).toBe('synced');
    expect(drive.calls.filter((call) => call.startsWith('save'))).toHaveLength(3);
  });

  it('gives up after the file keeps changing during every attempt', async () => {
    const { sync, drive } = setup();
    await sync.create('folder');
    const save = drive.remote.save;
    let round = 0;
    drive.remote.save = (file, board) => {
      drive.elsewhere('file1', (current) => withText(current, 'b', `elsewhere ${++round}`));
      return save(file, board);
    };
    sync.apply(setText('a', 'x'));
    await vi.advanceTimersByTimeAsync(SYNC_DELAY);
    expect(sync.current).toMatchObject({ status: 'failed', reason: 'conflict' });
    expect(drive.calls.filter((call) => call.startsWith('save'))).toHaveLength(3);
    // Each attempt still merged what had changed, so nothing was lost locally.
    expect(text(sync.load(), 'b')).toBe('elsewhere 3');
  });

  it('treats unexpected errors as unknown failures', async () => {
    const { sync, drive } = setup();
    await sync.create('folder');
    drive.remote.save = async () => {
      throw new TypeError('bug');
    };
    sync.apply(setText('a', 'x'));
    await vi.advanceTimersByTimeAsync(SYNC_DELAY);
    expect(sync.current).toMatchObject({ status: 'failed', reason: 'unknown', detail: 'bug' });
  });

  it('links an opened file without saving it back, and settles before switching', async () => {
    const { sync, drive, local, links } = setup();
    await sync.create('folder');
    sync.apply(setText('a', 'pending'));
    expect(await sync.settle()).toBe(true);
    expect(text(drive.files.get('file1')!.board, 'a')).toBe('pending');

    const opened = await sync.open('file1');
    sync.linkOpened(opened);
    // The app then puts the opened board in place.
    local.board = opened.board;
    sync.apply([]);
    await vi.advanceTimersByTimeAsync(SYNC_DELAY);
    expect(drive.calls.filter((call) => call.startsWith('save'))).toHaveLength(1);
    expect(links.link?.file).toEqual(opened.file);

    sync.unlink();
    expect(sync.current).toEqual({ status: 'unlinked' });
    expect(links.link).toBeNull();
    expect(await sync.settle()).toBe(true);
    await expect(sync.saveNow()).resolves.toBeUndefined();
    await expect(sync.resume()).resolves.toBeUndefined();
  });

  it('reports unsaved changes when settling is blocked', async () => {
    const { sync, drive } = setup();
    await sync.create('folder');
    drive.failures.push('auth');
    sync.apply(setText('a', 'x'));
    await vi.advanceTimersByTimeAsync(SYNC_DELAY);
    expect(await sync.settle()).toBe(false);
  });

  it('drops the results of requests for a file it no longer follows', async () => {
    const { sync, drive, links } = setup();
    await sync.create('folder');
    sync.apply(setText('a', 'x'));
    const saving = sync.saveNow();
    sync.unlink();
    await saving;
    expect(drive.calls.at(-1)).toBe('save file1');
    expect(links.link).toBeNull();
    expect(sync.current).toEqual({ status: 'unlinked' });
  });

  it('passes the local store’s save health and outside changes through', () => {
    const { sync } = setup();
    const saved = vi.fn();
    sync.watchSaved(saved);
    expect(saved).toHaveBeenCalledWith(true);
    const unsubscribe = sync.subscribe(() => {});
    unsubscribe();
  });
});
