// @vitest-environment jsdom
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../../src/app/App';
import { readClipboard, writeClipboard } from '../../../../src/adapters/browser/clipboard';
import { parseBoard } from '../../../../src/adapters/files/stormlet-format';
import { boardOf, sticky } from '../../../support/boards';
import { frame } from '../../../support/frames';
import { connection } from '../../../support/connections';
import { boardBounds, memoryStore, ids } from '../../../support/app';

vi.mock('../../../../src/adapters/browser/clipboard', () => ({
  readClipboard: vi.fn(),
  writeClipboard: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(readClipboard).mockReset();
  vi.mocked(writeClipboard).mockReset().mockResolvedValue();
});
const open = (node: Element, x = 400, y = 280) => {
  expect(fireEvent.contextMenu(node, { clientX: x, clientY: y })).toBe(false);
  return screen.getByRole('menu', { name: '캔버스 메뉴' });
};

describe('canvas context menus', () => {
  it('disables select all when every note is locked', () => {
    render(<App store={memoryStore(boardOf(sticky('a', { locked: true })))} newId={ids()} />);
    const menu = open(boardBounds());
    expect(within(menu).getByRole('menuitem', { name: /전체 선택/ })).toBeDisabled();
  });

  it('opens on empty canvas, adds at the cursor under zoom and supports undo and redo from the menu', async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    fireEvent.wheel(board, { clientX: 200, clientY: 80, deltaY: -Math.log(2) / 0.002 });
    let menu = open(board);
    expect(within(menu).getByRole('menuitem', { name: /실행 취소/ })).toBeDisabled();
    expect(within(menu).getByRole('menuitem', { name: /전체 선택/ })).toBeDisabled();
    await user.click(within(menu).getByRole('menuitem', { name: '포스트잇 추가 N' }));
    expect(store.board.stickies.s1).toMatchObject({ x: 20, y: 20 });
    await user.keyboard('{Enter}');
    menu = open(board);
    await user.click(within(menu).getByRole('menuitem', { name: /실행 취소/ }));
    expect(store.board.stickies).toEqual({});
    menu = open(board);
    await user.click(within(menu).getByRole('menuitem', { name: /다시 실행/ }));
    expect(store.board.stickies.s1).toBeDefined();
    menu = open(board, 800, 480);
    await user.click(within(menu).getByRole('menuitem', { name: '프레임 추가 F' }));
    expect(store.board.frames?.s2).toMatchObject({ x: 300, y: 200 });
  });
  it('opens with Shift+F10, navigates without triggering board shortcuts and restores focus on Escape', async () => {
    const user = userEvent.setup();
    render(<App store={memoryStore()} newId={ids()} />);
    const board = boardBounds();
    board.focus();
    await user.keyboard('{Shift>}{F10}{/Shift}');
    const menu = screen.getByRole('menu', { name: '캔버스 메뉴' });
    expect(within(menu).getByRole('menuitem', { name: '포스트잇 추가 N' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(within(menu).getByRole('menuitem', { name: '프레임 추가 F' })).toHaveFocus();
    await user.keyboard('n');
    expect(screen.getByRole('button', { name: '포스트잇 도구' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await user.keyboard('{End}');
    expect(within(menu).getByRole('menuitem', { name: /전체 보기/ })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(board).toHaveFocus();
    open(board);
    fireEvent.wheel(board, { deltaY: 20 });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
  it('provides frame and connection actions while preserving note-specific and native text menus', async () => {
    const user = userEvent.setup();
    const store = memoryStore({
      ...boardOf(sticky('a'), sticky('b', { x: 400 })),
      frames: { f: frame('f') },
      connections: { line: connection('line') },
    });
    render(<App store={store} newId={ids()} />);
    boardBounds();
    let menu = open(screen.getByRole('button', { name: '프레임: 프레임 1' }));
    await user.click(within(menu).getByRole('menuitem', { name: '프레임 잠금' }));
    menu = open(screen.getByRole('button', { name: '프레임: 프레임 1' }));
    expect(within(menu).getByRole('menuitem', { name: '프레임 삭제' })).toBeDisabled();
    await user.click(within(menu).getByRole('menuitem', { name: '프레임 잠금 해제' }));
    const line = screen.getByRole('button', { name: '연결선: a → b' });
    menu = open(line);
    await user.click(within(menu).getByRole('menuitem', { name: '연결선 삭제' }));
    expect(store.board.connections).toBeUndefined();
    fireEvent.contextMenu(screen.getByRole('button', { name: '도메인 이벤트: a' }));
    expect(screen.getByRole('menu', { name: '포스트잇 메뉴' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.dblClick(screen.getByRole('button', { name: '도메인 이벤트: a' }));
    expect(fireEvent.contextMenu(screen.getByRole('textbox', { name: '스티키 내용' }))).toBe(true);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
  it('pastes external text at the cursor and keeps the style of objects copied through the menu', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(sticky('a', { text: '원본', bold: true, color: 'blue' })));
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    vi.mocked(readClipboard).mockResolvedValue({ structured: '', plain: '외부 내용' });
    let menu = open(board, 700, 380);
    await user.click(within(menu).getByRole('menuitem', { name: /붙여넣기/ }));
    await waitFor(() =>
      expect(store.board.stickies.s1).toMatchObject({ text: '외부 내용', x: 500, y: 300 }),
    );
    await user.click(screen.getByRole('button', { name: '도메인 이벤트: 원본' }));
    menu = open(board);
    await user.click(within(menu).getByRole('menuitem', { name: /복사/ }));
    await waitFor(() => expect(writeClipboard).toHaveBeenCalled());
    const content = vi.mocked(writeClipboard).mock.calls.at(-1)![0];
    expect(parseBoard(content.structured).stickies.a).toMatchObject({ bold: true, color: 'blue' });
    vi.mocked(readClipboard).mockResolvedValue({ structured: '', plain: '원본' });
    menu = open(board, 900, 580);
    await user.click(within(menu).getByRole('menuitem', { name: /붙여넣기/ }));
    await waitFor(() =>
      expect(store.board.stickies.s2).toMatchObject({
        text: '원본',
        x: 700,
        y: 500,
        bold: true,
        color: 'blue',
      }),
    );
    vi.mocked(readClipboard).mockRejectedValue(new Error('denied'));
    menu = open(board);
    await user.click(within(menu).getByRole('menuitem', { name: /붙여넣기/ }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Ctrl/Cmd+V'));
    expect(Object.keys(store.board.stickies)).toHaveLength(3);
  });
});
