// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { App } from '../../../src/app/App';
import { memoryStore, ids, boardBounds } from '../../support/app';
import { boardOf, sticky } from '../../support/boards';

// jsdom has no PointerEvent; this one carries `pointerId`, so fingers can be told apart.
beforeAll(() => {
  window.PointerEvent = class extends MouseEvent {
    readonly pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  } as typeof PointerEvent;
});

const note = (text: string) => screen.getByRole('button', { name: `도메인 이벤트: ${text}` });

describe('multi-touch gestures', () => {
  it('keeps a drag with the finger that started it, ignoring a second finger', () => {
    const store = memoryStore(boardOf(sticky('a'), sticky('b', { x: 400 })));
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    fireEvent.pointerDown(note('a'), { button: 0, pointerId: 1, clientX: 300, clientY: 200 });
    fireEvent.pointerMove(board, { pointerId: 1, clientX: 340, clientY: 220 });
    expect(note('a')).toHaveClass('is-dragging');
    // A second finger on the background would clear the selection and start a marquee.
    fireEvent.pointerDown(board, { button: 0, pointerId: 2, clientX: 900, clientY: 600 });
    fireEvent.pointerMove(board, { pointerId: 2, clientX: 950, clientY: 650 });
    fireEvent.pointerUp(board, { pointerId: 2, clientX: 950, clientY: 650 });
    fireEvent.lostPointerCapture(board, { pointerId: 2 });
    expect(note('a')).toHaveClass('is-dragging', 'is-selected');
    // Nor does a second finger on another note take the drag over.
    fireEvent.pointerDown(note('b'), { button: 0, pointerId: 3, clientX: 700, clientY: 200 });
    expect(note('b')).not.toHaveClass('is-selected');
    fireEvent.pointerUp(board, { pointerId: 3, clientX: 700, clientY: 200 });
    fireEvent.pointerUp(board, { pointerId: 1, clientX: 340, clientY: 220 });
    expect(store.board.stickies.a).toMatchObject({ x: 40, y: 20 });
    expect(store.board.stickies.b).toMatchObject({ x: 400, y: 0 });
    // Once it ends, any finger starts the next gesture.
    fireEvent.pointerDown(note('b'), { button: 0, pointerId: 4, clientX: 700, clientY: 200 });
    fireEvent.pointerMove(board, { pointerId: 4, clientX: 720, clientY: 200 });
    fireEvent.pointerUp(board, { pointerId: 4, clientX: 720, clientY: 200 });
    expect(store.board.stickies.b).toMatchObject({ x: 420, y: 0 });
  });

  it('pans with the middle button pressed over a note', () => {
    const store = memoryStore(boardOf(sticky('a')));
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    fireEvent.pointerDown(note('a'), { button: 1, clientX: 300, clientY: 200 });
    fireEvent.pointerMove(board, { clientX: 360, clientY: 240 });
    fireEvent.pointerUp(board, { clientX: 360, clientY: 240 });
    expect(board.querySelector('.board-layer')).toHaveStyle({
      transform: 'translate(60px, 40px) scale(1)',
    });
    expect(store.board.stickies.a).toMatchObject({ x: 0, y: 0 });
  });

  it('ends a drag when a long press opens the note menu', () => {
    const store = memoryStore(boardOf(sticky('a')));
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    fireEvent.pointerDown(note('a'), { button: 0, clientX: 300, clientY: 200 });
    fireEvent.pointerMove(board, { clientX: 340, clientY: 220 });
    fireEvent.contextMenu(note('a'), { clientX: 340, clientY: 220 });
    expect(screen.getByRole('menu', { name: '포스트잇 메뉴' })).toBeInTheDocument();
    expect(note('a')).not.toHaveClass('is-dragging');
    fireEvent.pointerUp(board, { clientX: 380, clientY: 260 });
    expect(store.board.stickies.a).toMatchObject({ x: 0, y: 0 });
  });
});
