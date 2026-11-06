// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../../src/app/App';
import { stackOrder } from '../../../src/domain/model';
import { memoryStore, ids, boardBounds } from '../../support/app';
import { boardOf, sticky } from '../../support/boards';

const note = (text: string) => screen.getByRole('button', { name: `도메인 이벤트: ${text}` });
const menuFor = (text: string) => {
  fireEvent.contextMenu(note(text), { clientX: 600, clientY: 300 });
  return screen.getByRole('menu', { name: '포스트잇 메뉴' });
};

describe('board interactions', () => {
  it('combines selection and movement, and preserves stacking order while dragging', () => {
    const store = memoryStore(boardOf(sticky('a'), sticky('b', { x: 200, z: 2 })));
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    expect(screen.getByRole('button', { name: '선택 · 이동' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '이동' })).not.toBeInTheDocument();
    fireEvent.pointerDown(board, { button: 0, clientX: 400, clientY: 200 });
    fireEvent.pointerMove(board, { clientX: 460, clientY: 240 });
    fireEvent.pointerUp(board);
    expect(board.querySelector('.board-layer')).toHaveStyle({
      transform: 'translate(60px, 40px) scale(1)',
    });
    fireEvent.pointerDown(note('a'), { button: 0, clientX: 300, clientY: 200 });
    fireEvent.pointerMove(board, { clientX: 340, clientY: 220 });
    fireEvent.pointerUp(board);
    expect(store.board.stickies.a).toMatchObject({ x: 40, y: 20, z: 1 });
  });

  it('sends a note behind the others, brings it back and undoes either action', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(sticky('a'), sticky('b', { z: 2 }), sticky('c', { z: 3 })));
    render(<App store={store} newId={ids()} />);
    boardBounds();
    await user.click(within(menuFor('c')).getByRole('menuitem', { name: '맨 뒤로' }));
    expect(stackOrder(store.board).map(({ id }) => id)).toEqual(['c', 'a', 'b']);
    expect(note('c')).toHaveStyle({ zIndex: '1' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.click(within(menuFor('c')).getByRole('menuitem', { name: '맨 앞으로' }));
    expect(stackOrder(store.board).map(({ id }) => id)).toEqual(['a', 'b', 'c']);
    await user.keyboard('{Control>}z{/Control}');
    expect(stackOrder(store.board).map(({ id }) => id)).toEqual(['c', 'a', 'b']);
    await user.keyboard('{Control>}z{/Control}');
    expect(stackOrder(store.board).map(({ id }) => id)).toEqual(['a', 'b', 'c']);
  });

  it('applies context actions to the selected group without losing its internal order', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(sticky('a'), sticky('b', { z: 2 }), sticky('c', { z: 3 })));
    render(<App store={store} newId={ids()} />);
    boardBounds();
    fireEvent.pointerDown(note('b'), { button: 0 });
    fireEvent.pointerDown(note('c'), { button: 0, shiftKey: true });
    const menu = menuFor('b');
    expect(within(menu).getByText('포스트잇 2개')).toBeInTheDocument();
    await user.click(within(menu).getByRole('menuitem', { name: '맨 뒤로' }));
    expect(stackOrder(store.board).map(({ id }) => id)).toEqual(['b', 'c', 'a']);
  });

  it('resizes with presets and numeric dimensions, refits the text and keeps labels hidden', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(sticky('a', { text: '주문이 접수되었습니다' })));
    render(<App store={store} newId={ids()} />);
    boardBounds();
    const originalFont = parseFloat(
      note('주문이 접수되었습니다').querySelector('p')!.style.fontSize,
    );
    await user.click(
      within(menuFor('주문이 접수되었습니다')).getByRole('menuitem', { name: '크게 320 × 240' }),
    );
    expect(store.board.stickies.a).toMatchObject({ width: 320, height: 240, kind: 'event' });
    expect(
      parseFloat(note('주문이 접수되었습니다').querySelector('p')!.style.fontSize),
    ).toBeGreaterThan(originalFont);
    expect(note('주문이 접수되었습니다').querySelector('.sticky-kind')).toBeNull();
    const menu = menuFor('주문이 접수되었습니다');
    fireEvent.change(within(menu).getByRole('spinbutton', { name: '포스트잇 너비' }), {
      target: { value: '280' },
    });
    fireEvent.change(within(menu).getByRole('spinbutton', { name: '포스트잇 높이' }), {
      target: { value: '160' },
    });
    await user.click(within(menu).getByRole('menuitem', { name: '적용' }));
    expect(store.board.stickies.a).toMatchObject({ width: 280, height: 160 });
    await user.keyboard('{Control>}z{/Control}');
    expect(store.board.stickies.a).toMatchObject({ width: 320, height: 240 });
  });

  it('previews resizing at the current zoom and commits only once on release', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(sticky('a')));
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    fireEvent.wheel(board, { clientX: 200, clientY: 80, deltaY: -Math.log(2) / 0.002 });
    fireEvent.pointerDown(note('a'), { button: 0 });
    const handle = screen.getByRole('button', { name: '포스트잇 크기 조절' });
    fireEvent.pointerDown(handle, { button: 0, clientX: 520, clientY: 320 });
    fireEvent.pointerMove(board, { clientX: 680, clientY: 440 });
    expect(store.board.stickies.a).toMatchObject({ width: 160, height: 120 });
    expect(note('a')).toHaveStyle({ width: '240px', height: '180px' });
    fireEvent.pointerUp(board);
    expect(store.board.stickies.a).toMatchObject({ width: 240, height: 180 });
    await user.keyboard('{Control>}z{/Control}');
    expect(store.board.stickies.a).toMatchObject({ width: 160, height: 120 });
  });

  it('discards cancelled resize previews and supports keyboard resizing', () => {
    const store = memoryStore(boardOf(sticky('a')));
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    fireEvent.pointerDown(note('a'), { button: 0 });
    const handle = screen.getByRole('button', { name: '포스트잇 크기 조절' });
    fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(board, { clientX: 300, clientY: 300 });
    fireEvent.keyDown(board, { key: 'Escape' });
    fireEvent.pointerUp(board);
    expect(store.board.stickies.a).toMatchObject({ width: 160, height: 120 });
    fireEvent.pointerDown(note('a'), { button: 0 });
    fireEvent.keyDown(screen.getByRole('button', { name: '포스트잇 크기 조절' }), {
      key: 'ArrowRight',
    });
    expect(store.board.stickies.a.width).toBe(180);
  });

  it('opens the menu from the keyboard, navigates it and restores focus on Escape', () => {
    const store = memoryStore(boardOf(sticky('a')));
    render(<App store={store} newId={ids()} />);
    boardBounds();
    note('a').focus();
    fireEvent.keyDown(note('a'), { key: 'F10', shiftKey: true });
    expect(screen.getByRole('menuitem', { name: '맨 앞으로' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: '맨 뒤로' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(note('a')).toHaveFocus();
  });

  it('closes on outside clicks and leaves the native text editing menu available', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(sticky('a')));
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    menuFor('a');
    fireEvent.pointerDown(board, { button: 0 });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.click(within(menuFor('a')).getByRole('menuitem', { name: '내용 편집' }));
    const editor = screen.getByRole('textbox', { name: '스티키 내용' });
    fireEvent.contextMenu(editor);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(editor).toHaveFocus();
  });
});
