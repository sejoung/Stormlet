// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../../../src/app/App';
import { memoryStore, ids, boardBounds } from '../../../support/app';
import { boardOf, sticky } from '../../../support/boards';
import { NOTE_ICONS } from '../../../../src/domain/note-details';
import { en } from '../../../../src/i18n/locales/en';
import { ko } from '../../../../src/i18n/locales/ko';
import { GLYPHS } from '../../../../src/components/icons/glyphs';
import { noteIconSize, noteTextSize } from '../../../../src/engine/note-icon';

const note = (id = 'a') => document.querySelector(`[data-sticky-id="${id}"]`) as HTMLElement;

describe('note icons (ADR 0018)', () => {
  it('picks an icon from the toolbar, shows it above the text and removes it again', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(sticky('a', { kind: null })));
    render(<App store={store} newId={ids()} />);
    boardBounds();
    await user.click(note());
    const toolbar = screen.getByRole('toolbar', { name: '포스트잇 편집 도구' });
    await user.click(within(toolbar).getByRole('button', { name: '아이콘' }));
    await user.click(screen.getByRole('button', { name: '데이터베이스 아이콘' }));
    expect(store.board.stickies.a.icon).toBe('database');
    expect(note().querySelector('.sticky-icon')).toBeInTheDocument();
    await user.click(within(toolbar).getByRole('button', { name: '아이콘' }));
    expect(screen.getByRole('button', { name: '데이터베이스 아이콘' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: '아이콘 없음' }));
    expect(store.board.stickies.a.icon).toBeNull();
    expect(note().querySelector('.sticky-icon')).not.toBeInTheDocument();
    await user.keyboard('{Control>}z{/Control}');
    expect(store.board.stickies.a.icon).toBe('database');
  });

  it('offers no icon for text boxes', async () => {
    const user = userEvent.setup();
    render(
      <App
        store={memoryStore(boardOf(sticky('t', { objectType: 'text', icon: 'server' })))}
        newId={ids()}
      />,
    );
    boardBounds();
    await user.click(note('t'));
    expect(screen.queryByRole('button', { name: '아이콘' })).not.toBeInTheDocument();
    expect(note('t').querySelector('.sticky-icon')).not.toBeInTheDocument();
  });

  it('has a glyph and a name in every language for each icon', () => {
    expect(Object.keys(GLYPHS).sort()).toEqual([...NOTE_ICONS].sort());
    for (const icon of NOTE_ICONS) {
      expect(en[`icon.${icon}` as keyof typeof en]).toBeTruthy();
      expect(ko[`icon.${icon}` as keyof typeof ko]).toBeTruthy();
    }
  });

  it('leaves the text the note height minus the icon and its gap', () => {
    const size = { width: 160, height: 160 };
    expect(noteIconSize(size)).toBe(35);
    expect(noteTextSize({ icon: 'server' }, size)).toEqual({ width: 160, height: 119 });
    expect(noteTextSize({ icon: 'server', objectType: 'text' }, size)).toEqual(size);
    expect(noteTextSize({ icon: null }, size)).toEqual(size);
    expect(noteIconSize({ width: 1280, height: 960 })).toBe(48);
    expect(noteIconSize({ width: 80, height: 60 })).toBe(16);
  });
});
