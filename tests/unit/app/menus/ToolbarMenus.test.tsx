// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../../src/app/App';
import { downloadText } from '../../../../src/adapters/files/download';
import { readClipboard, writeClipboard } from '../../../../src/adapters/browser/clipboard';
import { boardBounds, memoryStore, ids } from '../../../support/app';
import { boardOf, sticky } from '../../../support/boards';

vi.mock('../../../../src/adapters/files/download', async (original) => ({
  ...(await original<typeof import('../../../../src/adapters/files/download')>()),
  downloadText: vi.fn(),
}));

vi.mock('../../../../src/adapters/browser/clipboard', () => ({
  readClipboard: vi.fn(),
  writeClipboard: vi.fn(),
}));

/** An item's name as shown, without its icon or shortcut. */
const label = (item: HTMLElement) => item.querySelector('.menu-text')?.textContent;
/** Open the menu `menu` and run its item `item`. */
const choose = (menu: string, item: RegExp | string) => {
  fireEvent.click(screen.getByRole('button', { name: menu }));
  fireEvent.click(
    within(screen.getByRole('menu', { name: menu })).getByRole('menuitem', { name: item }),
  );
};
const itemsOf = (menu: string) => {
  fireEvent.click(screen.getByRole('button', { name: menu }));
  const items = screen.getAllByRole('menuitem');
  const state = Object.fromEntries(
    items.map((item) => [label(item), !item.hasAttribute('disabled')]),
  );
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
  return state;
};

afterEach(() => localStorage.clear());

describe('toolbar menus', () => {
  it('opens from the keyboard, moves with the arrows and returns focus on Escape', async () => {
    const user = userEvent.setup();
    render(<App store={memoryStore()} newId={ids()} />);
    const file = screen.getByRole('button', { name: '파일' });
    expect(file).toHaveAttribute('aria-expanded', 'false');
    file.focus();
    await user.keyboard('{ArrowDown}');
    expect(file).toHaveAttribute('aria-expanded', 'true');
    // A build without Drive has only the local file commands.
    const items = screen.getAllByRole('menuitem');
    expect(items.map(label)).toEqual(['열기…', '파일로 내려받기']);
    expect(items[0]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(items[1]).toHaveFocus();
    // Board shortcuts stay out of an open menu.
    await user.keyboard('n');
    expect(screen.getByRole('menu', { name: '파일' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(file).toHaveFocus();

    await user.click(file);
    await user.click(screen.getByRole('application', { name: '포스트잇 보드' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.click(file);
    await user.keyboard('{Tab}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens files with ⌘/Ctrl+O and downloads with ⌘/Ctrl+S', () => {
    render(<App store={memoryStore()} newId={ids()} />);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const choose = vi.spyOn(input, 'click').mockImplementation(() => {});
    fireEvent.keyDown(window, { key: 'o', ctrlKey: true });
    expect(choose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '파일' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '열기…' }));
    expect(choose).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(window, { key: 's', metaKey: true });
    expect(downloadText).toHaveBeenCalledTimes(1);
  });

  it('lists help and troubleshooting under Settings', () => {
    render(<App store={memoryStore()} newId={ids()} />);
    fireEvent.click(screen.getByRole('button', { name: '설정' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '단축키 도움말' }));
    expect(screen.getByRole('dialog', { name: '단축키' })).toBeInTheDocument();
  });

  it('runs edits on the selection from the Edit menu, enabled only when they apply', async () => {
    vi.mocked(writeClipboard).mockResolvedValue();
    const store = memoryStore(boardOf(sticky('a'), sticky('b')));
    render(<App store={store} newId={ids()} />);
    boardBounds();
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(
      expect.arrayContaining(['파일', '편집', '보기', '설정']),
    );
    expect(itemsOf('편집')).toMatchObject({
      '실행 취소': false,
      잘라내기: false,
      복사: false,
      붙여넣기: true,
      복제: false,
      '모두 선택': true,
      '그룹으로 묶기': false,
      '메모 검색': true,
    });

    choose('편집', '모두 선택');
    expect(itemsOf('편집')).toMatchObject({ 복사: true, '그룹으로 묶기': true, 삭제: true });
    choose('편집', '그룹으로 묶기');
    expect(store.board.stickies.a.groupId).toBeTruthy();
    expect(store.board.stickies.a.groupId).toBe(store.board.stickies.b.groupId);
    choose('편집', '실행 취소');
    expect(store.board.stickies.a.groupId).toBeFalsy();
    choose('편집', '다시 실행');
    expect(store.board.stickies.a.groupId).toBeTruthy();

    choose('편집', '복사');
    await waitFor(() => expect(writeClipboard).toHaveBeenCalledTimes(1));
    vi.mocked(readClipboard).mockResolvedValue(vi.mocked(writeClipboard).mock.calls[0][0]);
    choose('편집', '붙여넣기');
    await waitFor(() => expect(Object.keys(store.board.stickies)).toHaveLength(4));
    choose('편집', '삭제');
    expect(Object.keys(store.board.stickies)).toHaveLength(2);
    choose('편집', '메모 검색');
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('zooms, fits and shows the minimap from the View menu', () => {
    render(<App store={memoryStore(boardOf(sticky('a')))} newId={ids()} />);
    boardBounds();
    const zoom = () => screen.getByRole('button', { name: '확대 비율 초기화' });
    expect(zoom()).toHaveTextContent('100%');
    choose('보기', '확대');
    expect(zoom()).toHaveTextContent('120%');
    choose('보기', '축소');
    choose('보기', '축소');
    expect(zoom()).toHaveTextContent('83%');
    choose('보기', '100%로 보기');
    expect(zoom()).toHaveTextContent('100%');
    expect(itemsOf('보기')).toMatchObject({ '모든 메모 보기': true, '선택 항목 보기': false });

    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    const minimap = screen.getByRole('menuitemcheckbox', { name: '미니맵' });
    expect(minimap).not.toBeChecked();
    fireEvent.click(minimap);
    expect(screen.getByRole('application', { name: /미니맵/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '보기' }));
    expect(screen.getByRole('menuitemcheckbox', { name: '미니맵' })).toBeChecked();
  });
});
