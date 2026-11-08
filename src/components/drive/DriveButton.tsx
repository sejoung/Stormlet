import type { SyncState } from '../../application/drive-sync';
import { Icon } from '../toolbar/Icon';
import { useT } from '../common/i18n';
import { ICONS, SHORT, STATUS, needsAttention } from './drive-status';

/**
 * The toolbar's Google Drive control: it shows how the board is syncing and opens Drive.
 * Close to the end of access it offers renewal, unless something more urgent is shown.
 */
export function DriveButton({
  state,
  expiring = false,
  onClick,
}: {
  state: SyncState;
  /** Access ends soon; clicking renews it. */
  expiring?: boolean;
  onClick(): void;
}) {
  const t = useT();
  const renewing = expiring && !needsAttention(state);
  const status = t(renewing ? 'drive.status.expiring' : STATUS[state.status]);
  const attention = renewing || needsAttention(state);
  return (
    <button
      type="button"
      className={`drive-button${attention ? ' attention' : ''}${renewing ? ' drive-renew' : ''}`}
      aria-label={t('drive.statusLabel', { status })}
      aria-busy={state.status === 'saving' || undefined}
      title={'file' in state ? `${state.file.name} — ${status}` : status}
      onClick={onClick}
    >
      <Icon name={renewing ? 'cloudAlert' : ICONS[state.status]} />
      <span>{t(renewing ? 'drive.short.expiring' : SHORT[state.status])}</span>
    </button>
  );
}
