// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../../../src/app/App';
import { frame } from '../../../support/frames';
import { boardOf, sticky } from '../../../support/boards';
import { boardBounds, memoryStore, ids } from '../../../support/app';

const initial = () => ({
  ...boardOf(sticky('a', { x: 40, y: 40 })),
  frames: {
    f: frame('f'),
    next: frame('next', { x: 900, y: 500, title: '프레임 2' }),
  },
});

describe('frame borders and connections', () => {
  it('persists border thickness, connects from a frame port and follows frame resizing and movement', async () => {
    const user = userEvent.setup();
    const store = memoryStore(initial());
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    const title = screen.getByRole('button', { name: '프레임: 프레임 1' });
    await user.click(title);
    await user.selectOptions(screen.getByRole('combobox', { name: '프레임 테두리 두께' }), '8');
    expect(store.board.frames?.f.borderWidth).toBe(8);
    const container = title.closest('[data-frame-id]') as HTMLElement;
    expect(container.style.getPropertyValue('--frame-border-width')).toBe('8px');
    fireEvent.pointerDown(within(container).getByRole('button', { name: '오른쪽 연결점' }), {
      button: 0,
      clientX: 850,
      clientY: 280,
    });
    fireEvent.pointerMove(board, { clientX: 1100, clientY: 780 });
    fireEvent.pointerUp(board, { clientX: 1100, clientY: 780 });
    expect(store.board.connections?.s1).toMatchObject({
      from: { frameId: 'f', side: 'right' },
      to: { frameId: 'next', side: 'auto' },
    });
    const line = screen.getByRole('button', { name: '연결선: 프레임 1 → 프레임 2' });
    const shape = () => line.querySelector('.connection-stroke')!.getAttribute('d');
    const before = shape();
    await user.click(title);
    const width = screen.getByRole('spinbutton', { name: '프레임 너비' });
    await user.clear(width);
    await user.type(width, '800{Enter}');
    expect(shape()).not.toBe(before);
    const resized = shape();
    fireEvent.pointerDown(title, { button: 0, clientX: 240, clientY: 70 });
    fireEvent.pointerMove(board, { clientX: 320, clientY: 110 });
    expect(shape()).not.toBe(resized);
    fireEvent.pointerUp(board, { clientX: 320, clientY: 110 });
    expect(store.board.frames?.f).toMatchObject({ x: 80, y: 40 });
    expect(store.board.stickies.a).toMatchObject({ x: 120, y: 80 });
    await user.keyboard('{Delete}');
    expect(store.board.frames?.f).toBeUndefined();
    expect(store.board.connections).toBeUndefined();
    expect(store.board.stickies.a).toBeDefined();
    await user.keyboard('{Control>}z{/Control}');
    expect(store.board.frames?.f.borderWidth).toBe(8);
    expect(store.board.connections?.s1).toBeDefined();
  });
  it('connects frames and notes using L and keyboard ports, including endpoint reattachment', async () => {
    const user = userEvent.setup();
    const store = memoryStore(initial());
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    board.focus();
    await user.keyboard('l');
    await user.click(screen.getByRole('button', { name: '프레임: 프레임 1' }));
    await user.click(screen.getByRole('button', { name: '도메인 이벤트: a' }));
    expect(store.board.connections?.s1).toMatchObject({
      from: { frameId: 'f' },
      to: { stickyId: 'a' },
    });
    expect(screen.queryByRole('textbox', { name: '프레임 이름' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '프레임: 프레임 1' }));
    const container = document.querySelector('[data-frame-id="f"]') as HTMLElement;
    fireEvent.click(within(container).getByRole('button', { name: '아래 연결점' }), { detail: 0 });
    const next = screen.getByRole('button', { name: '프레임: 프레임 2' });
    next.focus();
    fireEvent.keyDown(next, { key: 'Enter' });
    expect(store.board.connections?.s2).toMatchObject({
      from: { frameId: 'f', side: 'bottom' },
      to: { frameId: 'next' },
    });
    fireEvent.keyDown(screen.getByRole('button', { name: '연결선 끝점 이동' }), { key: 'Enter' });
    const note = screen.getByRole('button', { name: '도메인 이벤트: a' });
    note.focus();
    fireEvent.keyDown(note, { key: 'Enter' });
    expect(store.board.connections?.s2.to).toEqual({ stickyId: 'a', side: 'auto' });
  });
});
