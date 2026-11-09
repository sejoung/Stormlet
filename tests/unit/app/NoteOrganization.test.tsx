// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../../src/app/App';
import { memoryStore, ids, boardBounds } from '../../support/app';
import { boardOf, sticky } from '../../support/boards';

const note = (text: string) => screen.getByRole('button', { name: `도메인 이벤트: ${text}` });

describe('note organization', () => {
  it('selects with a background drag, groups notes and moves the whole group after selecting one member', async () => {
    const user = userEvent.setup();
    const store = memoryStore(
      boardOf(sticky('a', { x: 40, y: 40 }), sticky('b', { x: 250, y: 40 })),
    );
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    fireEvent.pointerDown(board, { button: 0, clientX: 220, clientY: 100 });
    fireEvent.pointerMove(board, { clientX: 650, clientY: 300 });
    fireEvent.pointerUp(board);
    expect(note('a')).toHaveAttribute('aria-pressed', 'true');
    expect(note('b')).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: '그룹으로 묶기' }));
    expect(store.board.stickies.a.groupId).toBe(store.board.stickies.b.groupId);
    fireEvent.pointerDown(board, { button: 0 });
    fireEvent.pointerUp(board);
    fireEvent.pointerDown(note('a'), { button: 0, clientX: 260, clientY: 140 });
    fireEvent.pointerMove(board, { clientX: 310, clientY: 170 });
    fireEvent.pointerUp(board);
    expect(store.board.stickies.a).toMatchObject({ x: 90, y: 70 });
    expect(store.board.stickies.b).toMatchObject({ x: 300, y: 70 });
    await user.click(screen.getByRole('button', { name: '그룹 해제' }));
    expect(store.board.stickies.a.groupId).toBeNull();
    await user.keyboard('{Control>}z{/Control}');
    expect(store.board.stickies.a.groupId).toBe(store.board.stickies.b.groupId);
  });

  it('duplicates by Alt-drag without changing the original and can undo the clone in one step', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(sticky('a', { x: 40, y: 40 })));
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    fireEvent.pointerDown(note('a'), { button: 0, altKey: true, clientX: 260, clientY: 140 });
    fireEvent.pointerMove(board, { clientX: 460, clientY: 180 });
    expect(Object.keys(store.board.stickies)).toEqual(['a']);
    fireEvent.pointerUp(board);
    expect(store.board.stickies.a).toMatchObject({ x: 40, y: 40 });
    expect(store.board.stickies.s1).toMatchObject({
      text: 'a',
      x: 240,
      y: 80,
      locked: false,
    });
    await user.keyboard('{Control>}z{/Control}');
    expect(Object.keys(store.board.stickies)).toEqual(['a']);
  });

  it('keeps selection while panning with Space and permits keyboard duplication and nudging', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(sticky('a')));
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    await user.click(note('a'));
    fireEvent.keyDown(board, { key: ' ', code: 'Space' });
    fireEvent.pointerDown(board, { button: 0, clientX: 500, clientY: 300 });
    fireEvent.pointerMove(board, { clientX: 550, clientY: 340 });
    fireEvent.pointerUp(board);
    fireEvent.keyUp(board, { key: ' ', code: 'Space' });
    expect(board.querySelector('.board-layer')).toHaveStyle({
      transform: 'translate(50px, 40px) scale(1)',
    });
    expect(note('a')).toHaveAttribute('aria-pressed', 'true');
    board.focus();
    await user.keyboard('{ArrowRight}{Shift>}{ArrowDown}{/Shift}{Control>}d{/Control}');
    expect(store.board.stickies.a).toMatchObject({ x: 1, y: 10 });
    expect(store.board.stickies.s1).toMatchObject({ x: 25, y: 34 });
  });

  it('aligns and spaces selected notes from the contextual toolbar', async () => {
    const user = userEvent.setup();
    const store = memoryStore(
      boardOf(
        sticky('a', { x: 40, y: 40 }),
        sticky('b', { x: 250, y: 180 }),
        sticky('c', { x: 500, y: 300 }),
      ),
    );
    render(<App store={store} newId={ids()} />);
    boardBounds().focus();
    await user.keyboard('{Control>}a{/Control}');
    // Several notes selected: the arrange icons are right under the toolbar.
    const arrange = screen.getByRole('toolbar', { name: '배치' });
    expect(within(arrange).getByRole('button', { name: '위쪽 맞춤' })).toHaveAttribute(
      'title',
      '위쪽 맞춤 (Alt / Option+W)',
    );
    await user.click(screen.getByRole('button', { name: '위쪽 맞춤' }));
    expect(Object.values(store.board.stickies).map((s) => s.y)).toEqual([40, 40, 40]);
    await user.click(screen.getByRole('button', { name: '가로 간격 맞춤' }));
    expect(store.board.stickies.b.x).toBe(270);
    await user.click(screen.getByRole('button', { name: '격자로 정리' }));
    expect(store.board.stickies.c.x).toBe(store.board.stickies.a.x);
    expect(store.board.stickies.c.y).toBeGreaterThan(store.board.stickies.a.y);
    // The same commands are in the Arrange menu, which needs two notes selected.
    await user.click(screen.getByRole('button', { name: '정렬' }));
    await user.click(screen.getByRole('menuitem', { name: /왼쪽 맞춤/ }));
    expect(new Set(Object.values(store.board.stickies).map((s) => s.x)).size).toBe(1);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: '정렬' }));
    expect(screen.getByRole('menuitem', { name: /너비 같게/ })).toBeDisabled();
  });

  it('matches widths from the arrange panel and snaps a resize to a matching size', async () => {
    const user = userEvent.setup();
    const store = memoryStore(
      boardOf(sticky('a', { x: 40, y: 40 }), sticky('b', { x: 400, y: 40, width: 240 })),
    );
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    fireEvent.pointerDown(note('b'), { button: 0 });
    fireEvent.pointerUp(board);
    // Dragging a's corner to 4px short of b's width snaps to it and marks both notes.
    fireEvent.pointerDown(note('a'), { button: 0 });
    fireEvent.pointerUp(board);
    const handle = screen.getByRole('button', { name: '포스트잇 크기 조절' });
    fireEvent.pointerDown(handle, { button: 0, clientX: 400, clientY: 280 });
    fireEvent.pointerMove(board, { clientX: 476, clientY: 300 });
    expect(note('a')).toHaveStyle({ width: '240px' });
    expect(document.querySelectorAll('.marker-width')).toHaveLength(2);
    expect(screen.getByText('240 × 140')).toBeInTheDocument();
    fireEvent.pointerUp(board);
    expect(store.board.stickies.a).toMatchObject({ width: 240, height: 140 });
    expect(document.querySelector('.size-marker')).toBeNull();
    await user.keyboard('{Control>}z{/Control}');
    fireEvent.pointerDown(note('b'), { button: 0, shiftKey: true });
    fireEvent.pointerUp(board);
    await user.click(screen.getByRole('button', { name: '너비 같게' }));
    expect(store.board.stickies.a).toMatchObject({ x: 40, width: 240, height: 120 });
  });
});
