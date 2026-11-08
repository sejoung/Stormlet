import { useEffect, useRef } from 'react';
import { useT } from '../common/i18n';
import { DiagnosticsCopy } from './DiagnosticsCopy';

interface Props {
  onRetry(): void;
  onDownload(): void;
  report(): string;
  copy(text: string): Promise<void>;
}

/** Shown in place of the board after it crashed, so the user is never left with a blank page. */
export function RecoveryScreen({ onRetry, onDownload, report, copy }: Props) {
  const t = useT();
  const heading = useRef<HTMLHeadingElement>(null);
  // Moving focus to the heading lets screen readers announce what happened.
  useEffect(() => heading.current?.focus(), []);
  return (
    <main className="recovery">
      <section className="recovery-card" aria-labelledby="recovery-title">
        <h1 id="recovery-title" ref={heading} tabIndex={-1}>
          {t('recovery.title')}
        </h1>
        <p>{t('recovery.description')}</p>
        <div className="recovery-actions">
          <button type="button" className="primary-button" onClick={onRetry}>
            {t('recovery.retry')}
          </button>
          <button type="button" onClick={onDownload}>
            {t('recovery.download')}
          </button>
        </div>
        <p className="recovery-hint">{t('recovery.report')}</p>
        <DiagnosticsCopy report={report} copy={copy} />
      </section>
    </main>
  );
}
