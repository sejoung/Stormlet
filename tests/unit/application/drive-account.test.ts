import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DriveSync } from '../../../src/application/drive-sync';
import { boardOf, sticky } from '../../support/boards';
import { fakeDrive, localStore, memoryLinks } from '../../support/drive';

const base = boardOf(sticky('a'));
const file = { id: 'f', name: 'Plan.stormlet', version: '1' };

/** A board linked to a file of `account`, waiting to reconnect after a reload. */
function remembered(account?: { id: string; email: string }) {
  const drive = fakeDrive();
  drive.files.set('f', { name: 'Plan.stormlet', version: 1, board: base });
  const local = localStore(boardOf(sticky('a', { text: 'edited' })));
  const links = memoryLinks({ file, base, account });
  const sync = new DriveSync(local, drive.remote, links);
  return { drive, local, links, sync };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Drive files and Google accounts', () => {
  it('never writes a file of another account, and continues once that account is back', async () => {
    const { drive, sync } = remembered({ id: 'work', email: 'work@example.com' });
    await sync.resume();
    expect(sync.current).toMatchObject({
      status: 'failed',
      reason: 'account',
      detail: 'work@example.com',
    });
    expect(drive.calls).toEqual([]);
    // Saving again checks again, and nothing is left to save before switching files.
    await sync.saveNow();
    expect(drive.calls).toEqual([]);
    expect(await sync.settle()).toBe(false);
    expect(drive.calls).toEqual([]);

    drive.who.account = { id: 'work', email: 'work@example.com' };
    await sync.saveNow();
    expect(sync.current.status).toBe('synced');
    expect(drive.files.get('f')!.board.stickies.a.text).toBe('edited');
  });

  it('learns the account of a link made before accounts were kept', async () => {
    const { links, sync } = remembered();
    await sync.resume();
    expect(links.link?.account).toEqual({ id: 'me', email: 'me@example.com' });
  });

  it('keeps going when the account cannot be told', async () => {
    const { drive, sync } = remembered({ id: 'work', email: 'work@example.com' });
    drive.remote.account = async () => {
      throw new Error('offline');
    };
    await sync.resume();
    expect(sync.current.status).toBe('synced');
  });

  it('records the account of a file it opens', async () => {
    const { links, sync } = remembered();
    sync.linkOpened(await sync.open('f'));
    expect(links.link?.account).toEqual({ id: 'me', email: 'me@example.com' });
  });
});
