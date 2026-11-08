import type { SyncState } from '../../application/drive-sync';
import { Icon } from '../toolbar/Icon';
import { useT } from '../common/i18n';
import { ICONS, SHORT, STATUS, needsAttention } from './drive-status';

/** The toolbar's Google Drive control: it shows how the board is syncing and opens Drive. */
export function DriveButton({ state, onClick }: { state: SyncState; onClick(): void }) {
  const t = useT();
  const status = t(STATUS[state.status]);
  return (
    <button
      type="button"
      className={`drive-button${needsAttention(state) ? ' attention' : ''}`}
      aria-label={t('drive.statusLabel', { status })}
      aria-busy={state.status === 'saving' || undefined}
      title={'file' in state ? `${state.file.name} — ${status}` : status}
      onClick={onClick}
    >
      <Icon name={ICONS[state.status]} />
      <span>{t(SHORT[state.status])}</span>
    </button>
  );
}
