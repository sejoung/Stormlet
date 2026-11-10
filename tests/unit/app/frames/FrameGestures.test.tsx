// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../../../src/app/App';
import { DEFAULT_CONNECTION } from '../../../../src/domain/connections/model';
import { boardBounds, ids, memoryStore } from '../../../support/app';
import { frame } from '../../../support/frames';
import { boardOf, sticky } from '../../../support/boards';

describe('frame gestures', () => {
  it('draws backwards at a zoomed scale and cancels incomplete gestures without saving', async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    fireEvent.wheel(board, { clientX: 200, clientY: 80, deltaY: -Math.log(2) / 0.002 });
    board.focus();
    await user.keyboard('f');
    fireEvent.pointerDown(board, { button: 0, clientX: 900, clientY: 480 });
    fireEvent.pointerMove(board, { clientX: 300, clientY: 180 });
    expect(document.querySelector('.frame-draft')).toHaveStyle({
      left: '50px',
      top: '50px',
      width: '300px',
      height: '150px',
    });
    expect(store.board.frames).toBeUndefined();
    await user.keyboard('{Escape}');
    fireEvent.pointerUp(board, { clientX: 300, clientY: 180 });
    expect(store.board.frames).toBeUndefined();
    await user.keyboard('f');
    fireEvent.pointerDown(board, { button: 0, clientX: 900, clientY: 480 });
    fireEvent.pointerUp(board, { clientX: 300, clientY: 180 });
    expect(store.board.frames?.s1).toMatchObject({ x: 50, y: 50, width: 300, height: 150 });
    await user.keyboard('f');
    fireEvent.pointerDown(board, { button: 0, clientX: 700, clientY: 400 });
    fireEvent.pointerCancel(board);
    fireEvent.pointerUp(board, { clientX: 700, clientY: 400 });
    expect(Object.keys(store.board.frames!)).toHaveLength(1);
  });

  it('previews notes and attached lines during a frame drag and undoes the entire move together', async () => {
    const user = userEvent.setup();
    const store = memoryStore({
      ...boardOf(
        sticky('a', { x: 40, y: 40 }),
        sticky('b', { x: 300, y: 40 }),
        sticky('c', { x: 800 }),
      ),
      frames: { frame: frame(), child: frame('child', { x: 20, y: 20, width: 500, height: 250 }) },
      connections: {
        line: {
          id: 'line',
          ...DEFAULT_CONNECTION,
          from: { stickyId: 'a', side: 'auto' as const },
          to: { stickyId: 'b', side: 'auto' as const },
        },
      },
    });
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    const edge = screen.getAllByRole('button', { name: '프레임 테두리: 프레임 1 · 위쪽' })[0];
    const note = screen.getByRole('button', { name: '도메인 이벤트: a' });
    const line = screen.getByRole('button', { name: '연결선: a → b' });
    const before = line.querySelector('.connection-stroke')!.getAttribute('d');
    fireEvent.pointerDown(edge, { button: 0, clientX: 300, clientY: 80 });
    fireEvent.pointerMove(board, { clientX: 380, clientY: 120 });
    expect(store.board.frames?.frame.x).toBe(0);
    expect(note).toHaveStyle({ left: '120px', top: '80px' });
    expect(line.querySelector('.connection-stroke')!.getAttribute('d')).not.toBe(before);
    fireEvent.pointerUp(board, { clientX: 380, clientY: 120 });
    expect(store.board.frames?.frame).toMatchObject({ x: 80, y: 40 });
    expect(store.board.frames?.child).toMatchObject({ x: 100, y: 60 });
    expect(store.board.stickies.a).toMatchObject({ x: 120, y: 80 });
    expect(store.board.stickies.c.x).toBe(800);
    await user.keyboard('{Control>}z{/Control}');
    expect(store.board.frames?.frame.x).toBe(0);
    expect(store.board.stickies.a.x).toBe(40);
    expect(line.querySelector('.connection-stroke')!.getAttribute('d')).toBe(before);
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(store.board.frames?.frame.x).toBe(80);
    const currentEdge = screen.getAllByRole('button', {
      name: '프레임 테두리: 프레임 1 · 위쪽',
    })[0];
    fireEvent.pointerDown(currentEdge, { button: 0, altKey: true, clientX: 380, clientY: 120 });
    fireEvent.pointerMove(board, { clientX: 1080, clientY: 120 });
    expect(note).toHaveStyle({ left: '120px', top: '80px' });
    expect(document.querySelector('.frame-draft')).toHaveStyle({ left: '780px' });
    fireEvent.pointerUp(board, { clientX: 1080, clientY: 120 });
    expect(Object.keys(store.board.frames!)).toHaveLength(4);
    expect(store.board.frames?.frame.x).toBe(80);
    expect(Object.keys(store.board.stickies)).toHaveLength(5);
  });

  it('treats a drag that ends back at its start as a click in the preview too', () => {
    const store = memoryStore({
      ...boardOf(sticky('a', { x: 40, y: 40 })),
      frames: { frame: frame() },
    });
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    const note = screen.getByRole('button', { name: '도메인 이벤트: a' });
    const edge = () => screen.getAllByRole('button', { name: '프레임 테두리: 프레임 1 · 위쪽' })[0];
    fireEvent.pointerDown(edge(), { button: 0, clientX: 300, clientY: 80 });
    fireEvent.pointerMove(board, { clientX: 380, clientY: 120 });
    expect(note).toHaveStyle({ left: '120px', top: '80px' });
    fireEvent.pointerMove(board, { clientX: 301, clientY: 81 });
    expect(note).toHaveStyle({ left: '40px', top: '40px' });
    fireEvent.pointerUp(board, { clientX: 301, clientY: 81 });
    expect(store.board.frames?.frame).toMatchObject({ x: 0, y: 0 });
    expect(note).toHaveStyle({ left: '40px', top: '40px' });

    fireEvent.pointerDown(edge(), { button: 0, altKey: true, clientX: 300, clientY: 80 });
    fireEvent.pointerMove(board, { clientX: 700, clientY: 80 });
    expect(document.querySelector('.frame-draft')).not.toBeNull();
    fireEvent.pointerMove(board, { clientX: 301, clientY: 80 });
    expect(document.querySelector('.frame-draft')).toBeNull();
    fireEvent.pointerUp(board, { clientX: 301, clientY: 80 });
    expect(Object.keys(store.board.frames!)).toEqual(['frame']);
  });

  it('resizes only the frame using the handle and keyboard and duplicates its contents independently', async () => {
    const user = userEvent.setup();
    const store = memoryStore({
      ...boardOf(sticky('a', { x: 20, y: 20 })),
      frames: { frame: frame() },
    });
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    await user.click(screen.getByRole('button', { name: '프레임: 프레임 1' }));
    const handle = screen.getByRole('button', { name: '프레임 크기 조절' });
    fireEvent.pointerDown(handle, { button: 0, clientX: 840, clientY: 480 });
    fireEvent.pointerMove(board, { clientX: 1000, clientY: 560 });
    expect(document.querySelector('[data-frame-id="frame"]')).toHaveStyle({
      width: '800px',
      height: '480px',
    });
    expect(store.board.frames?.frame.width).toBe(640);
    fireEvent.pointerUp(board, { clientX: 1000, clientY: 560 });
    expect(store.board.frames?.frame).toMatchObject({ width: 800, height: 480 });
    expect(store.board.stickies.a).toMatchObject({ width: 160, height: 120, x: 20, y: 20 });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(store.board.frames?.frame.width).toBe(820);
    await user.click(screen.getByRole('button', { name: '프레임 복제' }));
    expect(Object.keys(store.board.frames!)).toHaveLength(2);
    expect(Object.keys(store.board.stickies)).toHaveLength(2);
    expect(store.board.frames?.s1).toMatchObject({ x: 32, y: 32, width: 820 });
    expect(store.board.stickies.s2).toMatchObject({ x: 52, y: 52 });
    await user.keyboard('{Control>}z{/Control}');
    expect(Object.keys(store.board.frames!)).toHaveLength(1);
    expect(Object.keys(store.board.stickies)).toHaveLength(1);
  });

  it('supports nudging, lock shortcuts and fitting a selected empty frame', async () => {
    const user = userEvent.setup();
    const store = memoryStore({ ...boardOf(), frames: { frame: frame('frame', { x: 2000 }) } });
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    await user.click(screen.getByRole('button', { name: '프레임: 프레임 1' }));
    await user.keyboard('{ArrowRight}{Shift>}{ArrowDown}{/Shift}');
    expect(store.board.frames?.frame).toMatchObject({ x: 2001, y: 10 });
    await user.keyboard('{Alt>}2{/Alt}');
    expect(board.querySelector('.board-layer')!.getAttribute('style')).not.toContain(
      'translate(0px, 0px)',
    );
    await user.keyboard('{Control>}{Shift>}l{/Shift}{/Control}');
    expect(store.board.frames?.frame.locked).toBe(true);
    await user.keyboard('{Control>}{Shift>}l{/Shift}{/Control}');
    expect(store.board.frames?.frame.locked).toBe(false);
    await user.keyboard('{Control>}d{/Control}');
    expect(Object.keys(store.board.frames!)).toHaveLength(2);
    // Alt+arrow steps a whole frame plus a gap, as it does for notes.
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(store.board.frames?.s2).toMatchObject({ x: 2033, y: 42 + 400 + 24 });
  });
});
