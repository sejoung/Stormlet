import type { Conflict } from '../domain/sync/merge';
import type { RemoteFailure, RemoteFile } from '../domain/sync/remote';

/** Quiet time after the last edit before the board is saved to the linked file. */
export const SYNC_DELAY = 2000;
/** Continuous editing still saves at least this often. */
export const MAX_SYNC_WAIT = 10_000;
/** Waits before retrying a save that failed on the network; then it waits for the next edit. */
export const RETRY_DELAYS = [5_000, 15_000, 60_000] as const;
/** Save attempts in one run, each after merging what changed remotely in between. */
export const ROUNDS = 3;

/** `account`: the file is in another Google account than the one connected now. */
export type SyncFailure = Exclude<RemoteFailure, 'auth'> | 'unknown' | 'account';
export type SyncState =
  | { status: 'unlinked' }
  | { status: 'synced' | 'pending' | 'saving'; file: RemoteFile }
  /** The connection lapsed; edits stay local until the user reconnects. */
  | { status: 'paused'; file: RemoteFile }
  /** Both sides changed the same things; waiting for the user to choose. */
  | { status: 'conflict'; file: RemoteFile; conflicts: Conflict[] }
  | { status: 'failed'; file: RemoteFile; reason: SyncFailure; detail: string };

export type Status = SyncState['status'];
