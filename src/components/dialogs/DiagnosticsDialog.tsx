import { useT } from '../common/i18n';
import { Modal } from './Modal';
import { DiagnosticsCopy } from '../recovery/DiagnosticsCopy';

/** The diagnostics report to attach to a bug report, from the Settings menu. */
export function DiagnosticsDialog({
  diagnostics,
  onClose,
}: {
  diagnostics: { report(): string; copy(text: string): Promise<void> };
  onClose(): void;
}) {
  const t = useT();
  return (
    <Modal title={t('settings.diagnostics')} onClose={onClose}>
      <p className="modal-description">{t('settings.diagnosticsHint')}</p>
      <DiagnosticsCopy {...diagnostics} />
    </Modal>
  );
}
