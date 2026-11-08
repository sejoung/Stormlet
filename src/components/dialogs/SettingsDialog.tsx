import { LOCALES, translate, type LocalePreference } from '../../i18n/messages';
import { useT } from '../common/i18n';
import { Modal } from './Modal';
import { DiagnosticsCopy } from '../recovery/DiagnosticsCopy';

const CHOICES: readonly LocalePreference[] = ['auto', ...LOCALES];

export function SettingsDialog({
  language,
  onLanguage,
  diagnostics,
  onClose,
}: {
  language: LocalePreference;
  onLanguage(language: LocalePreference): void;
  diagnostics: { report(): string; copy(text: string): Promise<void> };
  onClose(): void;
}) {
  const t = useT();
  return (
    <Modal title={t('settings.title')} onClose={onClose}>
      <fieldset className="settings-group">
        <legend>{t('settings.language')}</legend>
        {CHOICES.map((choice) => (
          <label key={choice} className="settings-option">
            <input
              type="radio"
              name="language"
              value={choice}
              checked={language === choice}
              onChange={() => onLanguage(choice)}
            />
            {/* Each language is named in itself, so it can be found from any language. */}
            {choice === 'auto' ? t('settings.languageAuto') : translate(choice, 'language.name')}
          </label>
        ))}
      </fieldset>
      <section className="settings-group" aria-labelledby="settings-diagnostics">
        <h3 id="settings-diagnostics">{t('settings.diagnostics')}</h3>
        <p className="settings-hint">{t('settings.diagnosticsHint')}</p>
        <DiagnosticsCopy {...diagnostics} />
      </section>
    </Modal>
  );
}
