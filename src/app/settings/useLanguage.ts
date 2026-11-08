import { useEffect, useState } from 'react';
import { browserLanguages } from '../../adapters/browser/languages';
import { readLocalePreference, writeLocalePreference } from '../../adapters/storage/preferences';
import { pickLocale, translate, type LocalePreference } from '../../i18n/messages';

/**
 * The language the app is shown in: the one chosen in settings, or else the first of the
 * browser's languages with a catalog, or else English. The choice survives reloads.
 */
export function useLanguage() {
  const [preference, setPreference] = useState(readLocalePreference);
  const locale = preference === 'auto' ? pickLocale(browserLanguages()) : preference;
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = translate(locale, 'app.documentTitle');
  }, [locale]);
  return {
    preference,
    locale,
    choose: (next: LocalePreference) => {
      writeLocalePreference(next);
      setPreference(next);
    },
  };
}
