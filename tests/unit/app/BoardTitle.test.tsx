// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../src/app/App';
import { downloadText } from '../../../src/adapters/files/download';
import { parseBoard, serializeBoard } from '../../../src/adapters/files/stormlet-format';
import { memoryStore, ids, boardBounds } from '../../support/app';
import { boardOf, sticky } from '../../support/boards';

vi.mock('../../../src/adapters/files/download', async (original) => ({
  ...(await original<typeof import('../../../src/adapters/files/download')>()),
  downloadText: vi.fn(),
}));
afterEach(() => vi.clearAllMocks());

describe('board name editing', () => {
  it('renames on double-click, downloads using the title and keeps the name through note changes and undo', async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    render(<App store={store} newId={ids()} />);
    boardBounds();
    const title = screen.getByRole('button', { name: '보드 이름: My idea board' });
    await user.click(title);
    expect(screen.queryByRole('textbox', { name: '보드 이름' })).not.toBeInTheDocument();
    await user.dblClick(title);
    const input = screen.getByRole('textbox', { name: '보드 이름' });
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.type(input, '회고/기획: 1차{Enter}');
    expect(store.board.title).toBe('회고/기획: 1차');
    expect(screen.getByRole('button', { name: '보드 이름: 회고/기획: 1차' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: '파일' }));
    await user.click(screen.getByRole('menuitem', { name: /^파일로 내려받기/ }));
    const [filename, contents] = vi.mocked(downloadText).mock.calls.at(-1)!;
    expect(filename).toBe('회고-기획- 1차.stormlet');
    expect(parseBoard(contents).title).toBe('회고/기획: 1차');
    await user.click(screen.getByRole('button', { name: '가운데 붙이기' }));
    await user.type(screen.getByRole('textbox', { name: '스티키 내용' }), '생각{Enter}');
    expect(store.board.title).toBe('회고/기획: 1차');
    await user.keyboard('{Control>}z{/Control}{Control>}z{/Control}{Control>}z{/Control}');
    expect(store.board.title).toBeUndefined();
    expect(screen.getByRole('button', { name: '보드 이름: My idea board' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다시 실행' }));
    expect(store.board.title).toBe('회고/기획: 1차');
  });

  it('supports keyboard editing, Escape cancellation, IME input and blur confirmation', async () => {
    const user = userEvent.setup();
    const store = memoryStore({ title: '원래 이름', ...boardOf(sticky('a')) });
    render(<App store={store} newId={ids()} />);
    boardBounds();
    screen.getByRole('button', { name: '보드 이름: 원래 이름' }).focus();
    await user.keyboard('{Enter}');
    await user.clear(screen.getByRole('textbox', { name: '보드 이름' }));
    await user.type(screen.getByRole('textbox', { name: '보드 이름' }), '취소할 이름{Escape}');
    expect(store.board.title).toBe('원래 이름');
    await user.keyboard('{F2}');
    const input = screen.getByRole('textbox', { name: '보드 이름' });
    fireEvent.change(input, { target: { value: '한글 보드' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true, keyCode: 229 });
    expect(input).toHaveFocus();
    expect(store.board.title).toBe('원래 이름');
    await user.click(screen.getByRole('button', { name: '메모 검색' }));
    expect(store.board.title).toBe('한글 보드');
    expect(store.board.stickies.a).toBeDefined();
  });

  it('commits a pending name before keyboard saving and falls back to the default for empty input', async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    render(<App store={store} newId={ids()} />);
    boardBounds();
    await user.dblClick(screen.getByRole('button', { name: '보드 이름: My idea board' }));
    const input = screen.getByRole('textbox', { name: '보드 이름' });
    await user.clear(input);
    await user.type(input, '저장할 이름');
    await user.keyboard('{Control>}s{/Control}');
    expect(vi.mocked(downloadText).mock.calls.at(-1)?.[0]).toBe('저장할 이름.stormlet');
    expect(parseBoard(vi.mocked(downloadText).mock.calls.at(-1)![1]).title).toBe('저장할 이름');
    await user.dblClick(screen.getByRole('button', { name: '보드 이름: 저장할 이름' }));
    await user.clear(screen.getByRole('textbox', { name: '보드 이름' }));
    await user.keyboard('{Enter}');
    expect(store.board.title).toBe('My idea board');
  });

  it('restores embedded titles and uses the filename when importing an older untitled board', async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    const { container } = render(<App store={store} newId={ids()} />);
    boardBounds();
    const load = (name: string, text: string) => {
      const file = new File([text], name, { type: 'application/json' });
      Object.defineProperty(file, 'text', { value: async () => text });
      fireEvent.change(container.querySelector('input[type="file"]')!, {
        target: { files: [file] },
      });
    };
    load('다른 파일명.stormlet', serializeBoard({ title: '저장된 제목', ...boardOf(sticky('a')) }));
    await waitFor(() => expect(store.board.title).toBe('저장된 제목'));
    load(
      '이전 회고.stormlet',
      JSON.stringify({ format: 'stormlet', version: 4, stickies: [sticky('b')] }),
    );
    await waitFor(() => expect(store.board.title).toBe('이전 회고'));
    expect(store.board.stickies.b).toMatchObject({ width: 160, height: 120 });
    await user.click(screen.getByRole('button', { name: '파일' }));
    await user.click(screen.getByRole('menuitem', { name: /^파일로 내려받기/ }));
    expect(vi.mocked(downloadText).mock.calls.at(-1)?.[0]).toBe('이전 회고.stormlet');
  });
});
