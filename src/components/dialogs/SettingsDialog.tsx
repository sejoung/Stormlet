import { LOCALES, translate, type LocalePreference } from '../../i18n/messages';
import { useT } from '../common/i18n';
import { Modal } from './Modal';

const CHOICES: readonly LocalePreference[] = ['auto', ...LOCALES];

export function SettingsDialog({
  language,
  onLanguage,
  onClose,
}: {
  language: LocalePreference;
  onLanguage(language: LocalePreference): void;
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
    </Modal>
  );
}
