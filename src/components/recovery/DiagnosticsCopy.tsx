import { useState } from 'react';
import { useT } from '../common/i18n';

interface Props {
  /** Builds the report when asked, so it includes everything logged until then. */
  report(): string;
  copy(text: string): Promise<void>;
}

/**
 * Copies the diagnostics report. Where the clipboard is refused, the report is shown in a
 * read-only field to copy by hand, so it can always reach a bug report.
 */
export function DiagnosticsCopy({ report, copy }: Props) {
  const t = useT();
  const [result, setResult] = useState<{ copied: boolean; text: string } | null>(null);
  return (
    <div className="diagnostics-copy">
      <button
        type="button"
        onClick={async () => {
          const text = report();
          try {
            await copy(text);
            setResult({ copied: true, text });
          } catch {
            setResult({ copied: false, text });
          }
        }}
      >
        {t('diagnostics.copy')}
      </button>
      <p className="diagnostics-result" role="status">
        {result && t(result.copied ? 'diagnostics.copied' : 'diagnostics.copyFailed')}
      </p>
      {result && !result.copied && (
        <textarea
          className="diagnostics-text"
          aria-label={t('diagnostics.text')}
          readOnly
          rows={6}
          value={result.text}
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </div>
  );
}
