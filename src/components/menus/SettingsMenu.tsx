import { LOCALES, translate, type LocalePreference } from '../../i18n/messages';
import { MenuButton, MenuItem } from './MenuButton';
import { useT } from '../common/i18n';

const CHOICES: readonly LocalePreference[] = ['auto', ...LOCALES];

/** Preferences and help: the language, the shortcut list and the diagnostics report. */
export function SettingsMenu({
  language,
  onLanguage,
  onHelp,
  onDiagnostics,
}: {
  language: LocalePreference;
  onLanguage(language: LocalePreference): void;
  onHelp(): void;
  onDiagnostics(): void;
}) {
  const t = useT();
  return (
    <MenuButton label={t('toolbar.settings')}>
      {(close) => (
        <>
          <span className="context-caption">{t('settings.language')}</span>
          {CHOICES.map((choice) => (
            <MenuItem
              key={choice}
              // Each language is named in itself, so it can be found from any language.
              label={
                choice === 'auto' ? t('settings.languageAuto') : translate(choice, 'language.name')
              }
              checked={language === choice}
              close={close}
              onSelect={() => onLanguage(choice)}
            />
          ))}
          <div className="context-separator" role="separator" />
          <MenuItem label={t('chrome.shortcuts')} shortcut="?" close={close} onSelect={onHelp} />
          <MenuItem label={t('menu.diagnostics')} close={close} onSelect={onDiagnostics} />
        </>
      )}
    </MenuButton>
  );
}
