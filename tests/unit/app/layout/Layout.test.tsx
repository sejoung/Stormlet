// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../../../src/app/App';
import { GRID_KEY, GRID_SNAP_KEY } from '../../../../src/adapters/storage/preferences';
import { boardBounds, memoryStore, ids } from '../../../support/app';
import { boardOf, sticky } from '../../../support/boards';

afterEach(() => {
  localStorage.removeItem(GRID_KEY);
  localStorage.removeItem(GRID_SNAP_KEY);
});

const note = (id: string) =>
  screen.getByRole('button', { name: new RegExp(`^도메인 이벤트: ${id}`) });
/** Click a note (Shift adds it to the selection) without dragging it. */
const pick = (board: HTMLElement, id: string, shiftKey = false) => {
  fireEvent.pointerDown(note(id), { button: 0, shiftKey });
  fireEvent.pointerUp(board);
};
const drag = (
  board: HTMLElement,
  handle: Element,
  by: { x: number; y: number },
  keys: { shiftKey?: boolean; ctrlKey?: boolean } = {},
) => {
  fireEvent.pointerDown(handle, { button: 0, clientX: 500, clientY: 400 });
  fireEvent.pointerMove(board, { clientX: 500 + by.x, clientY: 400 + by.y, ...keys });
  fireEvent.pointerUp(board);
};
const choose = (menu: string, item: string) => {
  fireEvent.click(screen.getByRole('button', { name: menu }));
  fireEvent.click(
    within(screen.getByRole('menu', { name: menu })).getByRole('menuitemcheckbox', { name: item }),
  );
};

describe('layout conveniences', () => {
  it('resizes from any corner, keeps proportions with Shift and undoes in one step', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(sticky('a', { x: 100, y: 100 })));
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    pick(board, 'a');
    drag(board, note('a').querySelector('.handle-nw')!, { x: -40, y: -30 });
    expect(store.board.stickies.a).toMatchObject({ x: 60, y: 70, width: 200, height: 150 });
    drag(board, note('a').querySelector('.handle-se')!, { x: 40, y: 0 }, { shiftKey: true });
    expect(store.board.stickies.a).toMatchObject({ x: 60, y: 70, width: 240, height: 180 });
    await user.keyboard('{Control>}z{/Control}');
    expect(store.board.stickies.a).toMatchObject({ x: 60, y: 70, width: 200, height: 150 });
  });

  it('scales a multi-note selection from its frame and hides per-note handles', () => {
    const store = memoryStore(boardOf(sticky('a'), sticky('b', { x: 200 })));
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    pick(board, 'a');
    pick(board, 'b', true);
    expect(note('a').querySelector('.resize-handle')).toBeNull();
    drag(board, document.querySelector('.selection-frame .handle-se')!, { x: 360, y: 0 });
    expect(store.board.stickies.a).toMatchObject({ x: 0, width: 320, height: 120 });
    expect(store.board.stickies.b).toMatchObject({ x: 400, width: 320, height: 120 });
  });

  it('aligns and distributes with Option/Alt keys by physical key', () => {
    const store = memoryStore(
      boardOf(sticky('a'), sticky('b', { x: 300, y: 100 }), sticky('c', { x: 900, y: 40 })),
    );
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    pick(board, 'a');
    pick(board, 'b', true);
    pick(board, 'c', true);
    // On a Mac, Option+W types "∑"; the physical key still decides.
    fireEvent.keyDown(window, { key: '∑', code: 'KeyW', altKey: true });
    expect([store.board.stickies.b.y, store.board.stickies.c.y]).toEqual([0, 0]);
    fireEvent.keyDown(window, { key: 'Ó', code: 'KeyH', altKey: true, shiftKey: true });
    expect(store.board.stickies.b.x).toBe(450);
    fireEvent.keyDown(window, { key: 'å', code: 'KeyA', altKey: true });
    expect([store.board.stickies.b.x, store.board.stickies.c.x]).toEqual([0, 0]);
  });

  it('shows equal-spacing guides while dragging, snaps to them, and Ctrl/Cmd moves freely', () => {
    const store = memoryStore(
      boardOf(sticky('a'), sticky('c', { x: 560 }), sticky('b', { x: 900, y: 300 })),
    );
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    fireEvent.pointerDown(note('b'), { button: 0, clientX: 500, clientY: 400 });
    fireEvent.pointerMove(board, { clientX: 500 - 617, clientY: 100 });
    expect(document.querySelectorAll('.spacing-guide')).toHaveLength(2);
    fireEvent.pointerUp(board);
    expect(store.board.stickies.b).toMatchObject({ x: 280, y: 0 });
    fireEvent.pointerDown(note('b'), { button: 0, clientX: 500, clientY: 400 });
    fireEvent.pointerMove(board, { clientX: 503, clientY: 401, ctrlKey: true });
    expect(document.querySelector('.spacing-guide, .alignment-guide')).toBeNull();
    fireEvent.pointerUp(board);
    expect(store.board.stickies.b).toMatchObject({ x: 283, y: 1 });
  });

  it('draws the grid and snaps to it from the View menu, remembering both', () => {
    const store = memoryStore(boardOf(sticky('a')));
    const view = render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    choose('보기', '격자 보기');
    expect(board).toHaveClass('show-grid');
    choose('보기', '격자에 맞추기');
    fireEvent.pointerDown(note('a'), { button: 0, clientX: 500, clientY: 400 });
    fireEvent.pointerMove(board, { clientX: 537, clientY: 452 });
    fireEvent.pointerUp(board);
    expect(store.board.stickies.a).toMatchObject({ x: 40, y: 60 });
    view.unmount();
    render(<App store={memoryStore()} newId={ids()} />);
    expect(boardBounds()).toHaveClass('show-grid');
  });

  it('aligns, copies style and selects the same colour from the note menu and keys', async () => {
    const user = userEvent.setup();
    const store = memoryStore(
      boardOf(
        sticky('a', { color: 'blue', bold: true }),
        sticky('b', { x: 300, y: 100 }),
        sticky('c', { x: 600, color: 'blue' }),
      ),
    );
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    pick(board, 'a');
    pick(board, 'b', true);
    fireEvent.contextMenu(note('b'), { clientX: 600, clientY: 300 });
    await user.click(screen.getByRole('menuitem', { name: '위쪽 맞춤' }));
    expect(store.board.stickies.b.y).toBe(0);
    // Copy a's style with the keys, then paste it onto b from the menu.
    pick(board, 'a');
    fireEvent.keyDown(window, { key: 'ç', code: 'KeyC', altKey: true, ctrlKey: true });
    pick(board, 'b');
    fireEvent.contextMenu(note('b'), { clientX: 600, clientY: 300 });
    await user.click(screen.getByRole('menuitem', { name: /스타일 붙여넣기/ }));
    expect(store.board.stickies.b).toMatchObject({ color: 'blue', bold: true });
    fireEvent.contextMenu(note('a'), { clientX: 600, clientY: 300 });
    await user.click(screen.getByRole('menuitem', { name: '같은 색 메모 모두 선택' }));
    for (const id of ['a', 'b', 'c']) expect(note(id)).toHaveAttribute('aria-pressed', 'true');
  });

  it('continues typing in a new note with Tab (right) and Cmd/Ctrl+Enter (below)', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(sticky('a', { color: 'green' })));
    render(<App store={store} newId={ids()} />);
    boardBounds();
    await user.dblClick(note('a'));
    const editor = () => screen.getByRole('textbox', { name: '스티키 내용' });
    await user.clear(editor());
    await user.type(editor(), '첫째{Tab}');
    expect(store.board.stickies.a.text).toBe('첫째');
    expect(store.board.stickies.s1).toMatchObject({ x: 184, y: 0, color: 'green', text: '' });
    await user.type(editor(), '둘째{Control>}{Enter}{/Control}');
    expect(store.board.stickies.s1.text).toBe('둘째');
    expect(store.board.stickies.s2).toMatchObject({ x: 184, y: 144 });
    expect(editor()).toHaveFocus();
    await user.keyboard('{Escape}{Control>}z{/Control}');
    expect(store.board.stickies.s2).toBeUndefined();
    expect(store.board.stickies.s1.text).toBe('');
  });
});
