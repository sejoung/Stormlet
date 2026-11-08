// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../../../src/app/App';
import type { BoardLibrary } from '../../../../src/domain/store';
import { memoryStore, ids } from '../../../support/app';
import { boardOf, sticky } from '../../../support/boards';

/** Boards of closed tabs, as the browser's library would report them. */
function fakeLibrary() {
  return {
    closed: vi.fn<BoardLibrary['closed']>(async () => [
      {
        id: 'retro',
        title: 'Retro',
        notes: 3,
        preview: 'Went well · To try',
        savedAt: Date.UTC(2026, 10, 1),
        driveFile: null,
      },
      {
        id: 'plan',
        title: 'Plan',
        notes: 1,
        preview: '',
        savedAt: null,
        driveFile: 'Plan.stormlet',
      },
    ]),
    open: vi.fn<BoardLibrary['open']>(),
    startInTab: vi.fn<BoardLibrary['startInTab']>(),
    remove: vi.fn<BoardLibrary['remove']>(async () => true),
  };
}
const fromFile = (item: string) => {
  fireEvent.click(screen.getByRole('button', { name: '파일' }));
  fireEvent.click(screen.getByRole('menuitem', { name: item }));
};

describe('a board for each tab', () => {
  it('starts a new board in another tab, leaving this one as it is', async () => {
    const user = userEvent.setup();
    const library = fakeLibrary();
    const store = memoryStore(boardOf(sticky('a')));
    render(<App store={store} newId={ids()} library={library} />);
    fromFile('새 보드…');
    const dialog = screen.getByRole('dialog', { name: '새 보드' });
    expect(dialog).toHaveTextContent('새 보드는 새 탭에서 열리고');
    expect(within(dialog).queryByRole('button', { name: '지금 보드 내려받기' })).toBeNull();
    await user.type(within(dialog).getByRole('textbox', { name: '보드 이름' }), '회고{Enter}');
    expect(library.startInTab).toHaveBeenCalledWith('회고');
    expect(Object.keys(store.board.stickies)).toEqual(['a']);
  });

  it('starts it here when this tab is still empty', async () => {
    const library = fakeLibrary();
    const store = memoryStore(boardOf());
    render(<App store={store} newId={ids()} library={library} />);
    fromFile('새 보드…');
    fireEvent.click(screen.getByRole('button', { name: '새 보드 만들기' }));
    await waitFor(() => expect(store.board.title).toBe('My idea board'));
    expect(library.startInTab).not.toHaveBeenCalled();
  });

  it('lists boards of closed tabs to open in a new tab or delete', async () => {
    const library = fakeLibrary();
    render(<App store={memoryStore(boardOf(sticky('a')))} newId={ids()} library={library} />);
    fromFile('최근 보드…');
    const dialog = screen.getByRole('dialog', { name: '최근 보드' });
    const items = await within(dialog).findAllByRole('listitem');
    expect(items.map((item) => item.querySelector('strong')?.textContent)).toEqual([
      'Retro',
      'Plan',
    ]);
    expect(items[0]).toHaveTextContent('Went well · To try');
    expect(items[1]).toHaveTextContent('포스트잇 1개 · Drive: Plan.stormlet');

    const remove = within(items[1]).getByRole('button', { name: '삭제' });
    fireEvent.click(remove);
    expect(library.remove).not.toHaveBeenCalled();
    fireEvent.click(within(items[1]).getByRole('button', { name: '영구 삭제' }));
    await waitFor(() => expect(within(dialog).getAllByRole('listitem')).toHaveLength(1));
    expect(library.remove).toHaveBeenCalledWith('plan');

    fireEvent.click(within(dialog).getByRole('button', { name: '새 탭에서 열기' }));
    expect(library.open).toHaveBeenCalledWith('retro', 'tab');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens a closed board in this tab when it is empty', async () => {
    const library = fakeLibrary();
    library.closed.mockResolvedValue([]);
    render(<App store={memoryStore(boardOf())} newId={ids()} library={library} />);
    fromFile('최근 보드…');
    expect(await screen.findByText('닫은 탭의 보드가 없습니다.')).toBeInTheDocument();
    library.closed.mockResolvedValue([
      { id: 'retro', title: 'Retro', notes: 3, preview: '', savedAt: null, driveFile: null },
    ]);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    fromFile('최근 보드…');
    fireEvent.click(await screen.findByRole('button', { name: '열기' }));
    expect(library.open).toHaveBeenCalledWith('retro', 'here');
  });

  it('has no recent boards where the browser keeps a single board', () => {
    render(<App store={memoryStore()} newId={ids()} />);
    fireEvent.click(screen.getByRole('button', { name: '파일' }));
    expect(screen.queryByRole('menuitem', { name: '최근 보드…' })).not.toBeInTheDocument();
  });

  it('refuses a file too large to be a board before reading it', async () => {
    const store = memoryStore(boardOf(sticky('a')));
    render(<App store={store} newId={ids()} />);
    const file = new File(['{}'], 'huge.stormlet');
    Object.defineProperty(file, 'size', { value: 21 * 1024 * 1024 });
    const read = vi.fn();
    Object.defineProperty(file, 'text', { value: read });
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
    expect(
      await screen.findByText('열 수 없는 파일입니다: 파일이 20MB보다 큽니다'),
    ).toBeInTheDocument();
    expect(read).not.toHaveBeenCalled();
    expect(Object.keys(store.board.stickies)).toEqual(['a']);
  });
});
