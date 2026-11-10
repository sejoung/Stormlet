import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DriveSync, SYNC_DELAY } from '../../../src/application/drive-sync';
import type { Patch } from '../../../src/domain/patch';
import type { RemoteBoards } from '../../../src/domain/sync/remote';
import { boardOf, sticky } from '../../support/boards';
import { fakeDrive, localStore, memoryLinks } from '../../support/drive';

const setText = (value: string): Patch[] => [{ op: 'set', id: 'a', field: 'text', value }];

/** A board linked to a new file `file1`, with saves held until the test lets them finish. */
async function linked() {
  const local = localStore(boardOf(sticky('a')));
  const drive = fakeDrive();
  const links = memoryLinks();
  const sync = new DriveSync(local, drive.remote, links);
  await sync.create('folder');
  const save = drive.remote.save;
  const held: (() => void)[] = [];
  /** From now on each save waits for `finish()`. */
  const hold = () => {
    drive.remote.save = async (...args: Parameters<RemoteBoards['save']>) => {
      await new Promise<void>((resolve) => held.push(resolve));
      return save(...args);
    };
  };
  const finish = async () => {
    held.splice(0).forEach((resolve) => resolve());
    await vi.advanceTimersByTimeAsync(0);
  };
  return { local, drive, links, sync, hold, finish };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Drive sync across handovers', () => {
  it('keeps the linked file, and a save under way, when saving a copy fails', async () => {
    const { drive, links, sync, hold, finish } = await linked();
    hold();
    sync.apply(setText('during copy'));
    await vi.advanceTimersByTimeAsync(SYNC_DELAY);
    expect(sync.current.status).toBe('saving');
    drive.failures.push('network');
    await expect(sync.create('elsewhere')).rejects.toMatchObject({ reason: 'network' });
    await finish();
    expect(sync.current).toMatchObject({ status: 'synced', file: { id: 'file1' } });
    expect(links.link?.base.stickies.a.text).toBe('during copy');

    // Edits after the failed copy still go to the original file.
    sync.apply(setText('after copy'));
    await vi.advanceTimersByTimeAsync(SYNC_DELAY);
    await finish();
    expect(drive.files.get('file1')!.board.stickies.a.text).toBe('after copy');
  });

  it('stays paused when a save finishes after access ended, and pulls on reconnecting', async () => {
    const { drive, links, sync, hold, finish } = await linked();
    hold();
    sync.apply(setText('saved late'));
    await vi.advanceTimersByTimeAsync(SYNC_DELAY);
    sync.pause();
    await finish();
    expect(sync.current.status).toBe('paused');
    // The save did land, so it is the new base.
    expect(links.link?.file.version).toBe('2');

    drive.elsewhere('file1', (board) => ({ ...board, title: 'Renamed elsewhere' }));
    drive.calls.length = 0;
    await sync.reconnected();
    expect(drive.calls).toEqual(['version file1', 'open file1']);
    expect(sync.current.status).toBe('synced');
    expect(sync.load().title).toBe('Renamed elsewhere');
  });

  it('checks the account of a token that arrives while synced, before saving again', async () => {
    const { drive, sync } = await linked();
    drive.who.account = { id: 'other', email: 'other@example.com' };
    sync.apply(setText('pending'));
    await sync.reconnected();
    expect(sync.current).toMatchObject({
      status: 'failed',
      reason: 'account',
      detail: 'me@example.com',
    });
    await vi.advanceTimersByTimeAsync(SYNC_DELAY * 2);
    expect(drive.calls.filter((call) => call.startsWith('save'))).toEqual([]);

    // The right account again: saving continues.
    drive.who.account = { id: 'me', email: 'me@example.com' };
    await sync.reconnected();
    expect(sync.current.status).toBe('synced');
    expect(drive.files.get('file1')!.board.stickies.a.text).toBe('pending');
  });

  it('saves what is typed while settling before reporting nothing left', async () => {
    const { drive, sync } = await linked();
    sync.apply(setText('first'));
    let typed = false;
    // Text still in the editor reaches the board only when flushed, after the first save.
    const flush = () => {
      if (drive.calls.includes('save file1') && !typed) {
        typed = true;
        sync.apply(setText('typed while saving'));
      }
    };
    expect(await sync.settle(flush)).toBe(true);
    expect(drive.files.get('file1')!.board.stickies.a.text).toBe('typed while saving');
  });
});
