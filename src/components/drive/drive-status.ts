import type { SyncState } from '../../application/drive-sync';
import type { MessageKey } from '../../i18n/messages';
import type { IconName } from '../toolbar/Icon';

type Status = SyncState['status'];

/** How each sync state reads in the toolbar (short) and in full sentences. */
export const SHORT: Record<Status, MessageKey> = {
  unlinked: 'drive.short.unlinked',
  synced: 'drive.short.synced',
  pending: 'drive.short.saving',
  saving: 'drive.short.saving',
  paused: 'drive.short.paused',
  conflict: 'drive.short.conflict',
  failed: 'drive.short.failed',
};
export const STATUS: Record<Status, MessageKey> = {
  unlinked: 'drive.status.unlinked',
  synced: 'drive.status.synced',
  pending: 'drive.status.pending',
  saving: 'drive.status.saving',
  paused: 'drive.status.paused',
  conflict: 'drive.status.conflict',
  failed: 'drive.status.failed',
};
export const ICONS: Record<Status, IconName> = {
  unlinked: 'cloud',
  synced: 'cloudCheck',
  pending: 'cloudUpload',
  saving: 'cloudUpload',
  paused: 'cloudOff',
  conflict: 'cloudAlert',
  failed: 'cloudAlert',
};
/** States that need the user before saving goes on. */
export const needsAttention = (state: SyncState): boolean =>
  state.status === 'paused' || state.status === 'conflict' || state.status === 'failed';

export const FAILURES: Record<Extract<SyncState, { status: 'failed' }>['reason'], MessageKey> = {
  conflict: 'drive.failure.conflict',
  permission: 'drive.failure.permission',
  full: 'drive.failure.full',
  missing: 'drive.failure.missing',
  network: 'drive.failure.network',
  unreadable: 'drive.failure.unreadable',
  unknown: 'drive.failure.unknown',
  account: 'drive.failure.account',
};
