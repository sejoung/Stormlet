import type { Board } from '../domain/model';
import type { BoardStore } from '../domain/store';
import { diffBoards, type Patch } from '../domain/patch';
import { mergeBoards, same, type Side } from '../domain/sync/merge';
import {
  RemoteError,
  type RemoteAccount,
  type RemoteBoards,
  type RemoteFile,
  type RemoteLink,
  type RemoteLinks,
} from '../domain/sync/remote';

import { MAX_SYNC_WAIT, RETRY_DELAYS, ROUNDS, SYNC_DELAY } from './sync-state';
import type { Status, SyncFailure, SyncState } from './sync-state';

export { MAX_SYNC_WAIT, RETRY_DELAYS, SYNC_DELAY } from './sync-state';
export type { SyncFailure, SyncState } from './sync-state';

type Opened = Awaited<ReturnType<RemoteBoards['open']>> & { account?: RemoteAccount };

/**
 * Keeps the board in sync with one remote file (ADR 0010). It is the app's `BoardStore`:
 * every edit goes to the local store at once and, after `SYNC_DELAY`, to the file. Saving
 * checks the file's version; if someone else changed it, their changes are merged in
 * (three-way, against the board as last synced) and arrive in the editor as outside
 * patches, like another tab's. Real conflicts wait for the user's choice.
 *
 * Saves run one at a time, and linking another file bumps a generation so results of the
 * previous file's requests are dropped. Each tab's board has its own link (ADR 0011).
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
  /** A token arrived since the account was checked, so the next save checks it first. */
  private recheck = false;
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

  /**
   * Save the board as a new file in `folderId` and keep it in sync from now on. A linked
   * file stays linked (and saving) until then, so a failed copy changes nothing; with none,
   * this claims the board at once, so a `recover` under way yields.
   */
  async create(folderId: string): Promise<RemoteFile> {
    const generation = this.link ? this.generation : this.detach();
    const board = this.load();
    const [file, account] = await Promise.all([
      this.remote.create(folderId, board),
      this.account(),
    ]);
    if (generation === this.generation) {
      this.detach();
      this.remember({ file, base: board, account });
      this.set('synced');
      if (!same(this.load(), board)) this.changed();
    }
    return file;
  }

  /** Read a file to open; call `linkOpened` before putting it on the board. */
  async open(id: string): Promise<Opened> {
    const [opened, account] = await Promise.all([this.remote.open(id), this.account()]);
    return { ...opened, account };
  }

  /** The account the linked file is in, when known; a hint for signing in again. */
  get linkedAccount(): RemoteAccount | undefined {
    return this.link?.account;
  }

  /** The Google account the current access is for; undefined when it cannot be told. */
  account(): Promise<RemoteAccount | undefined> {
    return this.remote.account?.().catch(() => undefined) ?? Promise.resolve(undefined);
  }

  /** Link the file just opened, so replacing the board with it saves nothing back. */
  linkOpened({ file, board, account }: Opened): void {
    this.detach();
    this.remote.forgetUnconfirmed?.();
    this.remember({ file, base: board, account });
    this.set('synced');
  }

  /** Stop syncing; the board stays as it is. */
  unlink(): void {
    this.detach();
    this.remote.forgetUnconfirmed?.();
    this.link = null;
    this.links.write(null);
    this.set('unlinked');
  }

  /**
   * After connecting with no file linked: link the file a creation made before the page
   * was closed without hearing back, and save what changed here since. Null if none.
   */
  async recover(): Promise<RemoteFile | null> {
    if (this.link || !this.remote.unconfirmed) return null;
    const generation = this.generation;
    const [found, account] = await Promise.all([this.remote.unconfirmed(), this.account()]);
    // Linking or creating something meanwhile decides for the user.
    if (!found || generation !== this.generation || this.link) return null;
    this.remote.forgetUnconfirmed?.();
    this.remember({ file: found.file, base: found.board, account });
    this.set('synced');
    if (!same(this.load(), found.board)) this.changed();
    return found.file;
  }

  /** Access ended: keep edits local until `resume`. */
  pause(): void {
    if (!this.link) return;
    this.cancelWait();
    this.set('paused');
  }

  /** Save now, without waiting, and retry after a failure. */
  saveNow(): Promise<void> {
    if (!this.link) return Promise.resolve();
    // Another account may be connected by now; that is checked again first.
    return this.otherAccount() || this.state.status === 'paused' ? this.resume() : this.run();
  }

  /**
   * After reconnecting: take in what changed remotely, then save what changed here. The
   * file must be in the account connected now; a file of another account is never written.
   */
  async resume(): Promise<void> {
    if (!this.link) return;
    const generation = this.generation;
    this.set('saving');
    if (!(await this.verify(this.activeFor(generation)))) return;
    this.pullWanted = true;
    return this.run();
  }

  /**
   * A token arrived while a file is linked (signed in, renewed, another tab's), maybe for
   * another account: check it before more is written. Conflicts and failures check later.
   */
  reconnected(): Promise<void> {
    if (!this.link) return Promise.resolve();
    const { status } = this.state;
    if (status === 'paused' || this.otherAccount()) return this.resume();
    this.recheck = true;
    return ['synced', 'pending', 'saving'].includes(status) ? this.run() : Promise.resolve();
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
   * so the caller can safely switch files. `flush` commits text still being typed, before
   * and after each save, as typing goes on while one runs.
   */
  async settle(flush: () => void = () => {}): Promise<boolean> {
    for (let round = 0; ; round++) {
      flush();
      if (!this.link || same(this.load(), this.link.base)) return true;
      const { status } = this.state;
      const failed = status === 'failed' && (round > 0 || this.otherAccount());
      if (status === 'paused' || status === 'conflict' || failed || round === ROUNDS) return false;
      await this.run();
    }
  }

  // --- Internals ---

  /** Whether requests of `generation` still count; a lapse meanwhile keeps 'paused'. */
  private activeFor(generation: number): () => boolean {
    return () =>
      generation === this.generation && this.link !== null && this.state.status !== 'paused';
  }

  /** Whether the linked file is in the account connected now; stops with `account` if not. */
  private async verify(active: () => boolean): Promise<boolean> {
    this.recheck = false;
    const expected = this.link?.account;
    const current = await this.account();
    if (!active()) return false;
    if (expected && current && current.id !== expected.id) {
      this.cancelWait();
      this.set('failed', { reason: 'account', detail: expected.email });
      return false;
    }
    // A link made before accounts were kept learns its account now.
    if (!expected && current) this.remember({ ...this.link!, account: current });
    return true;
  }

  private otherAccount(): boolean {
    return this.state.status === 'failed' && this.state.reason === 'account';
  }

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
    const active = this.activeFor(generation);
    try {
      if (this.recheck && !(await this.verify(active))) return;
      if (this.pullWanted) {
        this.pullWanted = false;
        if (!(await this.pull(active, false))) return;
      }
      for (let round = 0; round < ROUNDS && active(); round++) {
        const board = this.load();
        if (same(board, this.link!.base)) return this.set('synced');
        this.set('saving');
        try {
          const file = await this.remote.save(this.link!.file, board);
          if (!live()) return;
          this.remember({ file, base: board, account: this.link!.account });
          this.retries = 0;
          // Saved, but access lapsed meanwhile: stay paused until reconnecting.
          if (!active()) return;
          // Edits made while saving go out on the usual schedule.
          if (same(this.load(), board)) this.set('synced');
          else this.changed();
          return;
        } catch (error) {
          if (!(error instanceof RemoteError && error.reason === 'conflict')) throw error;
          if (!(await this.pull(active, true))) return;
        }
      }
      if (active()) throw new RemoteError('conflict', 'The file kept changing while saving.');
    } catch (error) {
      if (active()) this.fail(error);
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
    this.remember({ file: theirs.file, base: theirs.board, account: this.link?.account });
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
