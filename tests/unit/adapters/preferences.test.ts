// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  LOCALE_KEY,
  MINIMAP_KEY,
  readLocalePreference,
  readMinimapOpen,
  writeLocalePreference,
  writeMinimapOpen,
} from '../../../src/adapters/storage/preferences';
import { browserLanguages } from '../../../src/adapters/browser/languages';

afterEach(() => localStorage.clear());

describe('preferences', () => {
  it('follows the browser language until one is chosen, and ignores unknown values', () => {
    expect(readLocalePreference()).toBe('auto');
    writeLocalePreference('ko');
    expect(localStorage.getItem(LOCALE_KEY)).toBe('ko');
    expect(readLocalePreference()).toBe('ko');
    localStorage.setItem(LOCALE_KEY, 'fr');
    expect(readLocalePreference()).toBe('auto');
  });

  it('remembers whether the minimap is open', () => {
    expect(readMinimapOpen()).toBe(false);
    writeMinimapOpen(true);
    expect(localStorage.getItem(MINIMAP_KEY)).toBe('open');
    expect(readMinimapOpen()).toBe(true);
  });

  it('reads the browser languages, or the single language when the list is empty', () => {
    expect(browserLanguages()).toEqual(['ko-KR']);
    Object.defineProperty(navigator, 'languages', { value: [], configurable: true });
    try {
      expect(browserLanguages()).toEqual([navigator.language]);
    } finally {
      Object.defineProperty(navigator, 'languages', { value: ['ko-KR'], configurable: true });
    }
  });
});
