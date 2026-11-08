import type { SyncState } from '../../application/drive-sync';
import { Icon } from '../toolbar/Icon';
import { useT } from '../common/i18n';
import { cx } from '../common/cx';
import { ICONS, SHORT, STATUS, needsAttention } from './drive-status';

/**
 * The toolbar's Google Drive button. Before the board is in Drive it says what to do
 * next: connect, then save. Once it is, it shows how syncing goes, and close to the end
 * of access it offers renewal unless something more urgent is shown.
 */
export function DriveButton({
  state,
  connected,
  expiring = false,
  onPrepare,
  onClick,
}: {
  state: SyncState;
  connected: boolean;
  /** Access ends soon; clicking renews it. */
  expiring?: boolean;
  /** Called when the pointer or focus arrives, to load Google's scripts before a click. */
  onPrepare?(): void;
  onClick(): void;
}) {
  const t = useT();
  if (!('file' in state)) {
    const label = t(connected ? 'drive.saveHere' : 'drive.connect');
    return (
      <button
        type="button"
        className="drive-button drive-cta"
        title={label}
        onPointerEnter={onPrepare}
        onFocus={onPrepare}
        onClick={onClick}
      >
        <Icon name={connected ? 'cloudUpload' : 'cloud'} size={16} />
        <span>{label}</span>
      </button>
    );
  }
  const renewing = expiring && !needsAttention(state);
  const status = t(renewing ? 'drive.status.expiring' : STATUS[state.status]);
  const attention = renewing || needsAttention(state);
  return (
    <button
      type="button"
      className={cx('drive-button', attention && 'attention', renewing && 'drive-renew')}
      aria-label={t('drive.statusLabel', { status })}
      aria-busy={state.status === 'saving' || undefined}
      title={`${state.file.name} — ${status}`}
      onPointerEnter={onPrepare}
      onFocus={onPrepare}
      onClick={onClick}
    >
      <Icon name={renewing ? 'cloudAlert' : ICONS[state.status]} size={16} />
      <span>{t(renewing ? 'drive.short.expiring' : SHORT[state.status])}</span>
    </button>
  );
}
