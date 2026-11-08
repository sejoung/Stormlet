import { en } from './locales/en';
import { ko } from './locales/ko';

/** Languages with a catalog in `locales/`; add a file there and list it here. */
export const LOCALES = ['en', 'ko'] as const;
export type Locale = (typeof LOCALES)[number];
/** Shown when none of the user's languages has a catalog. */
export const DEFAULT_LOCALE: Locale = 'en';

export type MessageKey = keyof typeof en;
export type MessageParams = Readonly<Record<string, string | number>>;
export type Translate = (key: MessageKey, params?: MessageParams) => string;

const CATALOGS: Record<Locale, Readonly<Record<MessageKey, string>>> = { en, ko };

export const isLocale = (value: unknown): value is Locale =>
  (LOCALES as readonly unknown[]).includes(value);

/** The message for `key` in `locale`, with each `{name}` replaced from `params`. */
export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
  // A key missing from every catalog shows as itself rather than breaking the screen.
  const message = CATALOGS[locale][key] ?? en[key] ?? key;
  if (!params) return message;
  return message.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder,
  );
}

export const translator =
  (locale: Locale): Translate =>
  (key, params) =>
    translate(locale, key, params);

/**
 * The first of the user's preferred languages (BCP 47 tags such as `ko-KR`) that has a
 * catalog, matched by its primary subtag; English when none does.
 */
export function pickLocale(languages: readonly string[]): Locale {
  for (const tag of languages) {
    const primary = tag.toLowerCase().split('-')[0];
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}

/** A chosen language, or `auto` to follow the browser's languages. */
export type LocalePreference = Locale | 'auto';

export const isLocalePreference = (value: unknown): value is LocalePreference =>
  value === 'auto' || isLocale(value);
