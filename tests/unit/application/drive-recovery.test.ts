import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DriveSync, SYNC_DELAY } from '../../../src/application/drive-sync';
import type { Board } from '../../../src/domain/model';
import { boardOf, sticky } from '../../support/boards';
import { fakeDrive, localStore, memoryLinks } from '../../support/drive';

const created = boardOf(sticky('a'));
const edited: Board = { ...created, stickies: { ...created.stickies, b: sticky('b') } };

/** A page reloaded after asking Drive to create a file, before the answer arrived. */
function reloaded(board: Board = edited) {
  const drive = fakeDrive();
  drive.files.set('made', { name: 'Plan.stormlet', version: 1, board: created });
  drive.unseen.id = 'made';
  const local = localStore(board);
  const links = memoryLinks();
  const sync = new DriveSync(local, drive.remote, links);
  return { drive, local, links, sync };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('recovering a creation the page did not hear back from', () => {
  it('links the file and saves what changed here since', async () => {
    const { sync, drive, links } = reloaded();
    expect(sync.current).toEqual({ status: 'unlinked' });
    const file = await sync.recover();
    expect(file).toEqual({ id: 'made', name: 'Plan.stormlet', version: '1' });
    expect(links.link).toEqual({
      file,
      base: created,
      account: { id: 'me', email: 'me@example.com' },
    });
    expect(drive.unseen.id).toBeNull();
    expect(sync.current.status).toBe('pending');
    await vi.advanceTimersByTimeAsync(SYNC_DELAY);
    expect(drive.files.get('made')).toMatchObject({ version: 2, board: edited });
    // Found once: a later connection has nothing to recover.
    expect(await sync.recover()).toBeNull();
  });

  it('finds nothing when the upload never landed, and keeps looking', async () => {
    const { sync, drive, links } = reloaded();
    drive.files.delete('made');
    expect(await sync.recover()).toBeNull();
    expect([links.link, drive.unseen.id]).toEqual([null, 'made']);
  });

  it('leaves it once the board moved on, and never overrides a newer link', async () => {
    const opened = reloaded();
    opened.sync.linkOpened(await opened.sync.open('made'));
    expect(opened.drive.unseen.id).toBeNull();

    const stopped = reloaded();
    stopped.sync.unlink();
    expect(await stopped.sync.recover()).toBeNull();

    // Saving to a folder while the lookup is out wins.
    const racing = reloaded();
    const recovering = racing.sync.recover();
    const file = await racing.sync.create('folder');
    expect(await recovering).toBeNull();
    expect(racing.links.link?.file).toEqual(file);
    expect(racing.sync.current).toMatchObject({ status: 'synced', file });
  });

  it('passes a failed lookup to the caller and stays unlinked', async () => {
    const { sync, drive } = reloaded();
    drive.failures.push('network');
    await expect(sync.recover()).rejects.toMatchObject({ reason: 'network' });
    expect(sync.current).toEqual({ status: 'unlinked' });
    expect(drive.unseen.id).toBe('made');
  });
});
