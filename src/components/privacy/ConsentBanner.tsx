import { useT } from '../common/i18n';

/**
 * Asks once whether usage statistics may be sent, without blocking the board. Nothing is
 * sent until the user allows it; the choice can be changed later in the settings menu.
 */
export function ConsentBanner({ onChoose }: { onChoose(consent: 'granted' | 'denied'): void }) {
  const t = useT();
  return (
    <section className="consent-banner" aria-labelledby="consent-title">
      <h2 id="consent-title">{t('consent.title')}</h2>
      <p>
        {t('consent.message')}{' '}
        <a href={`${t('manual.path')}#privacy`} target="_blank" rel="noopener noreferrer">
          {t('consent.details')}
        </a>
      </p>
      <div className="consent-actions">
        <button type="button" onClick={() => onChoose('denied')}>
          {t('consent.deny')}
        </button>
        <button type="button" className="primary-button" onClick={() => onChoose('granted')}>
          {t('consent.allow')}
        </button>
      </div>
    </section>
  );
}
