import { LOCALES, translate, type LocalePreference } from '../../i18n/messages';
import { MenuButton, MenuItem, MenuSection } from './MenuButton';
import { useT } from '../common/i18n';

const CHOICES: readonly LocalePreference[] = ['auto', ...LOCALES];

/**
 * Preferences and help: the language, usage statistics (in a build that has them), the
 * shortcut list and the diagnostics report.
 */
export function SettingsMenu({
  language,
  onLanguage,
  usageStats,
  onHelp,
  onDiagnostics,
}: {
  language: LocalePreference;
  onLanguage(language: LocalePreference): void;
  usageStats?: { on: boolean; onToggle(): void };
  onHelp(): void;
  onDiagnostics(): void;
}) {
  const t = useT();
  return (
    <MenuButton label={t('toolbar.settings')} icon="settings" framed>
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
          {usageStats && (
            <>
              <MenuSection />
              <MenuItem
                label={t('settings.usageStats')}
                kind="checkbox"
                checked={usageStats.on}
                close={close}
                onSelect={usageStats.onToggle}
              />
            </>
          )}
          <MenuSection />
          <MenuItem
            label={t('chrome.shortcuts')}
            icon="help"
            shortcut="?"
            close={close}
            onSelect={onHelp}
          />
          <MenuItem
            label={t('menu.manual')}
            icon="manual"
            close={close}
            // The guide is a page of its own, in this language, opened beside the board.
            onSelect={() => window.open(t('manual.path'), '_blank', 'noopener')}
          />
          <MenuItem
            label={t('menu.diagnostics')}
            icon="troubleshoot"
            close={close}
            onSelect={onDiagnostics}
          />
        </>
      )}
    </MenuButton>
  );
}
