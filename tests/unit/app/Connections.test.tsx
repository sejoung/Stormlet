// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../../src/app/App';
import { parseBoard } from '../../../src/adapters/files/stormlet-format';
import { downloadText } from '../../../src/adapters/files/download';
import { memoryStore, ids, boardBounds } from '../../support/app';
import { boardOf, sticky } from '../../support/boards';
import { connectedBoard } from '../../support/connections';

vi.mock('../../../src/adapters/files/download', async (original) => ({
  ...(await original<typeof import('../../../src/adapters/files/download')>()),
  downloadText: vi.fn(),
}));
const note = (id: string) => screen.getByRole('button', { name: `도메인 이벤트: ${id}` });
const line = () => screen.getByRole('button', { name: '연결선: a → b' });
const stroke = () => line().querySelector('.connection-stroke')!.getAttribute('d');

describe('flow connections', () => {
  it('connects and reattaches from keyboard-accessible ports without editing the note text', async () => {
    const user = userEvent.setup();
    const store = memoryStore(connectedBoard());
    render(<App store={store} newId={ids()} />);
    boardBounds();
    await user.click(note('a'));
    const port = within(note('a')).getByRole('button', { name: '아래 연결점' });
    fireEvent.click(port, { detail: 0 });
    note('c').focus();
    fireEvent.keyDown(note('c'), { key: 'Enter' });
    expect(store.board.connections?.s1).toMatchObject({
      from: { stickyId: 'a', side: 'bottom' },
      to: { stickyId: 'c' },
    });
    expect(screen.queryByRole('textbox', { name: '스티키 내용' })).not.toBeInTheDocument();
    const endpoint = screen.getByRole('button', { name: '연결선 끝점 이동' });
    fireEvent.keyDown(endpoint, { key: 'Enter' });
    note('b').focus();
    fireEvent.keyDown(note('b'), { key: 'Enter' });
    expect(store.board.connections?.s1.to).toEqual({ stickyId: 'b', side: 'auto' });
  });
  it('connects two notes with L, selects the arrow, and supports Delete and undo', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(sticky('a'), sticky('b', { x: 400, y: 200 })));
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    board.focus();
    await user.keyboard('l');
    expect(screen.getByRole('button', { name: '연결선 도구' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(note('a'));
    expect(store.board.connections).toBeUndefined();
    await user.click(note('b'));
    expect(store.board.connections?.s1).toMatchObject({
      from: { stickyId: 'a', side: 'auto' },
      to: { stickyId: 'b', side: 'auto' },
      endArrow: true,
    });
    expect(screen.getByRole('toolbar', { name: '연결선 편집 도구' })).toBeInTheDocument();
    expect(line().querySelector('.connection-stroke')).toHaveAttribute('marker-end');
    await user.click(line());
    await user.keyboard('{Delete}');
    expect(store.board.connections).toBeUndefined();
    await user.keyboard('{Control>}z{/Control}');
    expect(store.board.connections?.s1).toBeDefined();
    expect(note('a')).toBeInTheDocument();
  });

  it('creates from a side port and keeps the edge attached during zoomed dragging and resizing', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(sticky('a'), sticky('b', { x: 400, y: 200 })));
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    fireEvent.wheel(board, { clientX: 200, clientY: 80, deltaY: -Math.log(2) / 0.002 });
    await user.click(note('a'));
    const port = within(note('a')).getByRole('button', { name: '오른쪽 연결점' });
    fireEvent.pointerDown(port, { button: 0, pointerId: 1, clientX: 532, clientY: 200 });
    fireEvent.pointerMove(board, { pointerId: 1, clientX: 1160, clientY: 600 });
    expect(store.board.connections).toBeUndefined();
    fireEvent.pointerUp(board, { pointerId: 1, clientX: 1160, clientY: 600 });
    expect(store.board.connections?.s1.from).toEqual({ stickyId: 'a', side: 'right' });
    expect(store.board.connections?.s1.to).toEqual({ stickyId: 'b', side: 'auto' });
    const before = stroke();
    fireEvent.pointerDown(note('a'), { button: 0, clientX: 360, clientY: 200 });
    fireEvent.pointerMove(board, { clientX: 440, clientY: 240 });
    const preview = stroke();
    expect(preview).not.toBe(before);
    expect(store.board.stickies.a.x).toBe(0);
    fireEvent.pointerUp(board);
    expect(stroke()).toBe(preview);
    expect(store.board.stickies.a).toMatchObject({ x: 40, y: 20 });
    fireEvent.keyDown(screen.getByRole('button', { name: '포스트잇 크기 조절' }), {
      key: 'ArrowRight',
    });
    expect(stroke()).not.toBe(preview);
    expect(store.board.connections?.s1.from).toEqual({ stickyId: 'a', side: 'right' });
  });

  it('reconnects an endpoint to another note or a free point, and deletes incident lines with a note', async () => {
    const user = userEvent.setup();
    const store = memoryStore(connectedBoard());
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    await user.click(line());
    fireEvent.pointerDown(screen.getByRole('button', { name: '연결선 끝점 이동' }), {
      button: 0,
      clientX: 594,
      clientY: 340,
    });
    fireEvent.pointerMove(board, { clientX: 1080, clientY: 140 });
    fireEvent.pointerUp(board, { clientX: 1080, clientY: 140 });
    expect(store.board.connections?.line.to).toEqual({ stickyId: 'c', side: 'auto' });
    await user.keyboard('{Control>}z{/Control}');
    expect(store.board.connections?.line.to).toEqual({ stickyId: 'b', side: 'auto' });
    fireEvent.pointerDown(screen.getByRole('button', { name: '연결선 끝점 이동' }), {
      button: 0,
      clientX: 594,
      clientY: 340,
    });
    fireEvent.pointerMove(board, { clientX: 900, clientY: 500, ctrlKey: true });
    fireEvent.pointerUp(board, { clientX: 900, clientY: 500, ctrlKey: true });
    expect(store.board.connections?.line.to).toEqual({ x: 700, y: 420 });
    await user.click(note('a'));
    await user.keyboard('{Delete}');
    expect(store.board.connections).toBeUndefined();
    expect(store.board.stickies.a).toBeUndefined();
    await user.keyboard('{Control>}z{/Control}');
    expect(store.board.stickies.a).toBeDefined();
    expect(store.board.connections?.line.to).toEqual({ x: 700, y: 420 });
  });

  it('edits line style and label, cancels a label draft and saves unfinished text', async () => {
    const user = userEvent.setup();
    const store = memoryStore(connectedBoard());
    render(<App store={store} newId={ids()} />);
    boardBounds();
    await user.dblClick(line());
    const input = screen.getByRole('textbox', { name: '연결선 설명' });
    expect(input).toHaveFocus();
    await user.type(input, '승인 후 진행{Enter}');
    expect(store.board.connections?.line.label).toBe('승인 후 진행');
    expect(screen.getByText('승인 후 진행')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: '연결선 종류' }), 'curve');
    await user.selectOptions(screen.getByRole('combobox', { name: '연결선 두께' }), '4');
    await user.click(screen.getByRole('button', { name: '파란색 연결선' }));
    await user.click(screen.getByRole('checkbox', { name: '시작 화살표' }));
    await user.click(screen.getByRole('checkbox', { name: '점선' }));
    expect(store.board.connections?.line).toMatchObject({
      path: 'curve',
      width: 4,
      color: 'blue',
      startArrow: true,
      dashed: true,
    });
    await user.click(input);
    await user.clear(input);
    await user.type(input, '취소할 설명{Escape}');
    expect(store.board.connections?.line.label).toBe('승인 후 진행');
    await user.click(input);
    await user.clear(input);
    await user.type(input, '저장 중인 설명');
    await user.keyboard('{Control>}s{/Control}');
    const saved = vi.mocked(downloadText).mock.calls.at(-1)!;
    expect(parseBoard(saved[1]).connections?.line.label).toBe('저장 중인 설명');
  });

  it('locks line editing while attached notes remain movable', async () => {
    const user = userEvent.setup();
    const store = memoryStore(connectedBoard());
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    await user.click(line());
    await user.click(screen.getByRole('button', { name: '연결선 잠금' }));
    expect(screen.getByRole('button', { name: '연결선 삭제' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '연결선 끝점 이동' })).not.toBeInTheDocument();
    await user.keyboard('{Delete}');
    expect(store.board.connections?.line.locked).toBe(true);
    fireEvent.pointerDown(note('a'), { button: 0, clientX: 280, clientY: 140 });
    fireEvent.pointerMove(board, { clientX: 320, clientY: 160 });
    fireEvent.pointerUp(board);
    expect(store.board.stickies.a.x).toBe(40);
    expect(store.board.connections?.line.locked).toBe(true);
  });

  it('cancels drafts and supports Shift-constrained independent lines without accidental notes', async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    await user.click(screen.getByRole('button', { name: '연결선 도구' }));
    fireEvent.pointerDown(board, { button: 0, clientX: 250, clientY: 400 });
    fireEvent.pointerMove(board, { clientX: 500, clientY: 430 });
    fireEvent.keyDown(board, { key: 'Escape' });
    fireEvent.pointerUp(board, { clientX: 500, clientY: 430 });
    expect(store.board.connections).toBeUndefined();
    await user.click(screen.getByRole('button', { name: '연결선 도구' }));
    fireEvent.pointerDown(board, { button: 0, clientX: 250, clientY: 400, ctrlKey: true });
    fireEvent.pointerMove(board, { clientX: 500, clientY: 430, shiftKey: true, ctrlKey: true });
    fireEvent.pointerUp(board, { clientX: 500, clientY: 430, shiftKey: true, ctrlKey: true });
    const saved = Object.values(store.board.connections ?? {})[0];
    expect(saved.from).toEqual({ x: 50, y: 320 });
    expect(saved.to).toMatchObject({ y: 320 });
    expect(store.board.stickies).toEqual({});
    expect(screen.queryByText('작은 생각이, 큰 그림이 되도록.')).not.toBeInTheDocument();
  });

  it('copies and pastes a whole flow with fresh endpoint IDs in one undo step', async () => {
    const user = userEvent.setup();
    const store = memoryStore(connectedBoard());
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    board.focus();
    await user.keyboard('{Control>}a{/Control}');
    const values = new Map<string, string>();
    const clipboardData = {
      setData: (type: string, value: string) => values.set(type, value),
      getData: (type: string) => values.get(type) ?? '',
    };
    fireEvent.copy(board, { clipboardData });
    fireEvent.paste(board, { clipboardData });
    expect(Object.keys(store.board.stickies)).toHaveLength(6);
    expect(Object.keys(store.board.connections ?? {})).toHaveLength(2);
    const pasted = Object.values(store.board.connections!).find((edge) => edge.id !== 'line')!;
    expect(pasted.from).not.toEqual({ stickyId: 'a', side: 'auto' });
    expect(pasted.to).not.toEqual({ stickyId: 'b', side: 'auto' });
    await user.keyboard('{Control>}z{/Control}');
    expect(Object.keys(store.board.stickies)).toHaveLength(3);
    expect(Object.keys(store.board.connections ?? {})).toEqual(['line']);
  });
});
