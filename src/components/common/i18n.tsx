import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_LOCALE, translator, type Locale, type Translate } from '../../i18n/messages';

interface I18n {
  locale: Locale;
  t: Translate;
}

const I18nContext = createContext<I18n>({
  locale: DEFAULT_LOCALE,
  t: translator(DEFAULT_LOCALE),
});

/** Shows everything inside in `locale`; changing it re-renders the text in place. */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: translator(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** The translate function for the current language. */
export const useT = (): Translate => useContext(I18nContext).t;

export const useLocale = (): Locale => useContext(I18nContext).locale;
