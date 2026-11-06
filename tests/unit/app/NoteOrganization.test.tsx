// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
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
    await user.click(screen.getByRole('button', { name: '정렬과 배치' }));
    await user.click(screen.getByRole('button', { name: '위쪽 맞춤' }));
    expect(Object.values(store.board.stickies).map((s) => s.y)).toEqual([40, 40, 40]);
    await user.click(screen.getByRole('button', { name: '가로 간격 맞춤' }));
    expect(store.board.stickies.b.x).toBe(270);
    await user.click(screen.getByRole('button', { name: '격자로 정리' }));
    expect(store.board.stickies.c.x).toBe(store.board.stickies.a.x);
    expect(store.board.stickies.c.y).toBeGreaterThan(store.board.stickies.a.y);
  });
});
