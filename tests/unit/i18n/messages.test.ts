import { describe, expect, it } from 'vitest';
import { en } from '../../../src/i18n/locales/en';
import { ko } from '../../../src/i18n/locales/ko';
import {
  isLocalePreference,
  LOCALES,
  pickLocale,
  translate,
  type MessageKey,
} from '../../../src/i18n/messages';

const CATALOGS: Record<string, Readonly<Record<string, string>>> = { en, ko };
const placeholders = (message: string) =>
  [...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('message catalogs', () => {
  it('has a catalog for every language, each with exactly the English keys', () => {
    expect(Object.keys(CATALOGS).sort()).toEqual([...LOCALES].sort());
    for (const locale of LOCALES)
      expect(Object.keys(CATALOGS[locale]).sort(), locale).toEqual(Object.keys(en).sort());
  });

  it('translates every message, keeping its placeholders', () => {
    for (const locale of LOCALES)
      for (const [key, message] of Object.entries(CATALOGS[locale])) {
        expect(message.trim(), `${locale} ${key}`).not.toBe('');
        expect(placeholders(message), `${locale} ${key}`).toEqual(
          placeholders(en[key as MessageKey]),
        );
      }
  });

  it('names each language in itself', () => {
    expect(translate('en', 'language.name')).toBe('English');
    expect(translate('ko', 'language.name')).toBe('한국어');
  });
});

describe('translate', () => {
  it('fills placeholders and leaves unknown ones visible', () => {
    expect(translate('en', 'files.opened', { name: 'plan.stormlet' })).toBe(
      'Opened plan.stormlet.',
    );
    expect(translate('ko', 'files.opened', { name: 'plan.stormlet' })).toBe(
      'plan.stormlet을(를) 열었습니다.',
    );
    expect(translate('en', 'files.opened')).toBe('Opened {name}.');
  });

  it('shows a key missing from every catalog as itself', () => {
    expect(translate('ko', 'missing.key' as MessageKey)).toBe('missing.key');
  });
});

describe('pickLocale', () => {
  it('takes the first preferred language that has a catalog', () => {
    expect(pickLocale(['ko-KR', 'en-US'])).toBe('ko');
    expect(pickLocale(['fr-FR', 'KO'])).toBe('ko');
    expect(pickLocale(['en-GB', 'ko'])).toBe('en');
  });

  it('falls back to English when no language is supported', () => {
    expect(pickLocale(['fr-FR', 'ja'])).toBe('en');
    expect(pickLocale([])).toBe('en');
  });

  it('accepts only supported languages or auto as a preference', () => {
    expect(['auto', 'en', 'ko'].every(isLocalePreference)).toBe(true);
    expect([null, '', 'fr', 'ko-KR', 1].some(isLocalePreference)).toBe(false);
  });
});
