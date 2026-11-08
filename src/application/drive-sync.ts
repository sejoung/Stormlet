import type { Board } from '../domain/model';
import type { BoardStore } from '../domain/store';
import { diffBoards, type Patch } from '../domain/patch';
import { mergeBoards, same, type Conflict, type Side } from '../domain/sync/merge';
import {
  RemoteError,
  type RemoteBoards,
  type RemoteFailure,
  type RemoteFile,
  type RemoteLink,
  type RemoteLinks,
} from '../domain/sync/remote';

/** Quiet time after the last edit before the board is saved to the linked file. */
export const SYNC_DELAY = 2000;
/** Continuous editing still saves at least this often. */
export const MAX_SYNC_WAIT = 10_000;
/** Waits before retrying a save that failed on the network; then it waits for the next edit. */
export const RETRY_DELAYS = [5_000, 15_000, 60_000] as const;
/** Save attempts in one run, each after merging what changed remotely in between. */
const ROUNDS = 3;

export type SyncFailure = Exclude<RemoteFailure, 'auth'> | 'unknown';
export type SyncState =
  | { status: 'unlinked' }
  | { status: 'synced' | 'pending' | 'saving'; file: RemoteFile }
  /** The connection lapsed; edits stay local until the user reconnects. */
  | { status: 'paused'; file: RemoteFile }
  /** Both sides changed the same things; waiting for the user to choose. */
  | { status: 'conflict'; file: RemoteFile; conflicts: Conflict[] }
  | { status: 'failed'; file: RemoteFile; reason: SyncFailure; detail: string };

type Status = SyncState['status'];
type Opened = Awaited<ReturnType<RemoteBoards['open']>>;

/**
 * Keeps the board in sync with one remote file (ADR 0010). It is the app's `BoardStore`:
 * every edit goes to the local store at once and, after `SYNC_DELAY`, to the file. Saving
 * checks the file's version; if someone else changed it, their changes are merged in
 * (three-way, against the board as last synced) and arrive in the editor as outside
 * patches, like another tab's. Real conflicts wait for the user's choice.
 *
 * Saves run one at a time, and linking another file bumps a generation so results of the
 * previous file's requests are dropped.
 */
export class DriveSync implements BoardStore {
  private link: RemoteLink | null;
  private state: SyncState;
  private readonly listeners = new Set<(patches: Patch[]) => void>();
  private readonly watchers = new Set<(state: SyncState) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private firstPending: number | null = null;
  private running: Promise<void> | null = null;
  private rerun = false;
  private pullWanted = false;
  private retries = 0;
  private generation = 0;
  /** The remote side of a conflict waiting for the user. */
  private theirs: Opened | null = null;

  constructor(
    private readonly local: BoardStore,
    private readonly remote: RemoteBoards,
    private readonly links: RemoteLinks,
    private readonly now: () => number = Date.now,
    /** The local board was lost (unreadable); start from the board as last synced. */
    restore = false,
  ) {
    this.link = links.read();
    // Otherwise the empty board would read as deleting everything, and that would sync.
    if (restore && this.link) local.apply(diffBoards(local.load(), this.link.base));
    // Access lives in memory only, so a remembered file waits until the user reconnects.
    this.state = this.link ? { status: 'paused', file: this.link.file } : { status: 'unlinked' };
  }

  // --- BoardStore ---

  load(): Board {
    return this.local.load();
  }

  apply(patches: readonly Patch[]): void {
    this.local.apply(patches);
    this.changed();
  }

  subscribe(listener: (patches: Patch[]) => void): () => void {
    this.listeners.add(listener);
    const unsubscribe = this.local.subscribe(listener);
    return () => {
      this.listeners.delete(listener);
      unsubscribe();
    };
  }

  watchSaved(listener: (saved: boolean) => void): () => void {
    return this.local.watchSaved?.(listener) ?? (() => {});
  }

  // --- Sync ---

  get current(): SyncState {
    return this.state;
  }

  /** Called with every state change; returns an unsubscribe. */
  watch(listener: (state: SyncState) => void): () => void {
    this.watchers.add(listener);
    return () => this.watchers.delete(listener);
  }

  /** Save the board as a new file in `folderId` and keep it in sync from now on. */
  async create(folderId: string): Promise<RemoteFile> {
    const generation = this.detach();
    const board = this.load();
    const file = await this.remote.create(folderId, board);
    if (generation === this.generation) {
      this.remember({ file, base: board });
      this.set('synced');
      if (!same(this.load(), board)) this.changed();
    }
    return file;
  }

  /** Read a file to open; call `linkOpened` before putting it on the board. */
  open(id: string): Promise<Opened> {
    return this.remote.open(id);
  }

  /** Link the file just opened, so replacing the board with it saves nothing back. */
  linkOpened({ file, board }: Opened): void {
    this.detach();
    this.remember({ file, base: board });
    this.set('synced');
  }

  /** Stop syncing; the board stays as it is. */
  unlink(): void {
    this.detach();
    this.link = null;
    this.links.write(null);
    this.set('unlinked');
  }

  /** Access ended: keep edits local until `resume`. */
  pause(): void {
    if (!this.link) return;
    this.cancelWait();
    this.set('paused');
  }

  /** Save now, without waiting, and retry after a failure. */
  saveNow(): Promise<void> {
    return this.link ? this.run() : Promise.resolve();
  }

  /** After reconnecting: take in what changed remotely, then save what changed here. */
  resume(): Promise<void> {
    if (!this.link) return Promise.resolve();
    this.pullWanted = true;
    this.set('saving');
    return this.run();
  }

  /** Finish a conflict with a side for each conflict key; unnamed ones keep the local side. */
  resolve(choices: Readonly<Record<string, Side>>): Promise<void> {
    const theirs = this.theirs;
    if (this.state.status !== 'conflict' || !theirs || !this.link) return Promise.resolve();
    const merged = mergeBoards(this.link.base, this.load(), theirs.board, (c) => choices[c.key]);
    this.theirs = null;
    this.adopt(theirs, merged.board);
    return this.run();
  }

  /**
   * Save what is pending before the linked file changes. True when nothing is left unsaved,
   * so the caller can safely switch files.
   */
  async settle(): Promise<boolean> {
    if (!this.link) return true;
    if (!['paused', 'conflict'].includes(this.state.status)) await this.run();
    return !this.link || same(this.load(), this.link.base);
  }

  // --- Internals ---

  private changed(): void {
    if (!this.link) return;
    const { status } = this.state;
    // A lapsed connection or an open conflict needs the user first; edits stay local.
    if (status === 'paused' || status === 'conflict') return;
    if (status === 'failed' && this.state.reason !== 'network') return;
    if (status !== 'saving') this.set('pending');
    const now = this.now();
    this.firstPending ??= now;
    this.wait(Math.max(0, Math.min(SYNC_DELAY, this.firstPending + MAX_SYNC_WAIT - now)));
  }

  private wait(delay: number): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.run(), delay);
  }

  private cancelWait(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.firstPending = null;
  }

  /** Forget the current file's pending work; returns the new generation. */
  private detach(): number {
    this.cancelWait();
    this.theirs = null;
    this.pullWanted = false;
    this.retries = 0;
    return ++this.generation;
  }

  private run(): Promise<void> {
    this.cancelWait();
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = this.sync().finally(() => {
      this.running = null;
      if (!this.rerun) return;
      this.rerun = false;
      void this.run();
    });
    return this.running;
  }

  private async sync(): Promise<void> {
    const generation = this.generation;
    const live = () => generation === this.generation && this.link !== null;
    try {
      if (this.pullWanted) {
        this.pullWanted = false;
        if (!(await this.pull(live, false))) return;
      }
      for (let round = 0; round < ROUNDS && live(); round++) {
        const board = this.load();
        if (same(board, this.link!.base)) return this.set('synced');
        this.set('saving');
        try {
          const file = await this.remote.save(this.link!.file, board);
          if (!live()) return;
          this.remember({ file, base: board });
          this.retries = 0;
          // Edits made while saving go out on the usual schedule.
          if (same(this.load(), board)) this.set('synced');
          else this.changed();
          return;
        } catch (error) {
          if (!(error instanceof RemoteError && error.reason === 'conflict')) throw error;
          if (!(await this.pull(live, true))) return;
        }
      }
      if (live()) throw new RemoteError('conflict', 'The file kept changing while saving.');
    } catch (error) {
      if (live()) this.fail(error);
    }
  }

  /**
   * Merge what changed in the file into the board. False when the run should stop: the
   * file was switched meanwhile, or a conflict now waits for the user.
   */
  private async pull(live: () => boolean, changed: boolean): Promise<boolean> {
    const { file } = this.link!;
    if (!changed && (await this.remote.version(file.id)) === file.version) return live();
    const theirs = await this.remote.open(file.id);
    if (!live()) return false;
    const merged = mergeBoards(this.link!.base, this.load(), theirs.board);
    if (merged.conflicts.length) {
      this.theirs = theirs;
      this.set('conflict', { conflicts: merged.conflicts });
      return false;
    }
    this.adopt(theirs, merged.board);
    return true;
  }

  /** Put the merged board in place and make the remote version the new base. */
  private adopt(theirs: Opened, merged: Board): void {
    const patches = diffBoards(this.load(), merged);
    if (patches.length) {
      this.local.apply(patches);
      for (const listener of this.listeners) listener(patches);
    }
    this.remember({ file: theirs.file, base: theirs.board });
  }

  private fail(error: unknown): void {
    const reason = error instanceof RemoteError ? error.reason : 'unknown';
    const detail = error instanceof Error ? error.message : String(error);
    if (reason === 'auth') return this.set('paused');
    this.set('failed', { reason: reason as SyncFailure, detail });
    if (reason === 'network' && this.retries < RETRY_DELAYS.length)
      this.wait(RETRY_DELAYS[this.retries++]);
  }

  private remember(link: RemoteLink): void {
    this.link = link;
    this.links.write(link);
  }

  private set(status: Status, extra: object = {}): void {
    const next = (
      status === 'unlinked' || !this.link
        ? { status: 'unlinked' }
        : { status, file: this.link.file, ...extra }
    ) as SyncState;
    if (same(next, this.state)) return;
    this.state = next;
    for (const watcher of this.watchers) watcher(next);
  }
}
