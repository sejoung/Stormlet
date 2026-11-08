// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../../src/app/App';
import { LOCALE_KEY } from '../../../src/adapters/storage/preferences';
import { memoryStore, ids } from '../../support/app';

/** Render the app in a browser whose preferred languages are `languages`. */
function renderIn(...languages: string[]) {
  Object.defineProperty(navigator, 'languages', { value: languages, configurable: true });
  render(<App store={memoryStore()} newId={ids()} />);
}

const openSettings = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('language', () => {
  afterEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'languages', { value: ['ko-KR'], configurable: true });
  });

  it('starts in English when none of the browser languages is supported', () => {
    renderIn('fr-FR', 'de');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(screen.getByText('Autosaved in this browser')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe('Stormlet — Sticky note board');
  });

  it('starts in the first supported browser language', () => {
    renderIn('fr-FR', 'ko-KR', 'en');
    expect(screen.getByRole('button', { name: '실행 취소' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('ko');
    expect(document.title).toBe('Stormlet — 포스트잇 보드');
  });

  it('switches language from the settings and remembers the choice', () => {
    renderIn('fr-FR');
    openSettings('Settings');
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(screen.getByRole('radio', { name: 'Browser language' })).toBeChecked();
    // Each language is listed in its own name, so it can be found from any language.
    fireEvent.click(screen.getByRole('radio', { name: '한국어' }));
    expect(dialog).toHaveAccessibleName('설정');
    expect(screen.getByRole('radio', { name: '한국어' })).toBeChecked();
    expect(screen.getByRole('button', { name: '실행 취소' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('ko');
    expect(localStorage.getItem(LOCALE_KEY)).toBe('ko');

    cleanup();
    renderIn('fr-FR');
    expect(screen.getByRole('button', { name: '실행 취소' })).toBeInTheDocument();
    openSettings('설정');
    fireEvent.click(screen.getByRole('radio', { name: '브라우저 언어' }));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(localStorage.getItem(LOCALE_KEY)).toBe('auto');
  });

  it('keeps generated titles in English whatever the language', () => {
    renderIn('ko-KR');
    expect(screen.getByRole('button', { name: '보드 이름: My idea board' })).toBeInTheDocument();
  });
});
