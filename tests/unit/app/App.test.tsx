// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../../src/app/App';
import { memoryStore, ids, boardBounds, startDrag, drop } from '../../support/app';

describe('App', () => {
  it('ignores background double-clicks and keeps note double-clicks for editing', async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    await user.dblClick(board);
    expect(store.board.stickies).toEqual({});
    expect(screen.queryByRole('textbox', { name: '스티키 내용' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '가운데 붙이기' }));
    await user.type(screen.getByRole('textbox', { name: '스티키 내용' }), '아이디어{Enter}');
    await user.dblClick(screen.getByRole('button', { name: '노란색 포스트잇: 아이디어' }));
    const editor = screen.getByRole('textbox', { name: '스티키 내용' });
    expect(editor).toHaveFocus();
    await user.dblClick(editor);
    expect(editor).toHaveValue('아이디어');
    expect(Object.keys(store.board.stickies)).toEqual(['s1']);
  });

  it('adds a free sticky with the center button, edits its text and undoes both steps', async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    render(<App store={store} newId={ids()} />);
    boardBounds();
    await user.click(screen.getByRole('button', { name: '가운데 붙이기' }));
    await user.type(screen.getByRole('textbox', { name: '스티키 내용' }), '새 아이디어{Enter}');
    expect(
      screen.getByRole('button', { name: '노란색 포스트잇: 새 아이디어' }),
    ).toBeInTheDocument();
    expect(store.board.stickies.s1).toMatchObject({
      text: '새 아이디어',
      kind: null,
      color: 'yellow',
    });
    await user.keyboard('{Control>}z{/Control}');
    expect(screen.getByRole('button', { name: '노란색 포스트잇: 빈 스티키' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '실행 취소' }));
    expect(store.board.stickies).toEqual({});
    await user.click(screen.getByRole('button', { name: '다시 실행' }));
    expect(Object.keys(store.board.stickies)).toEqual(['s1']);
  });

  it('keeps a new note selected and lets Escape switch back to picking the next color', async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    render(<App store={store} newId={ids()} />);
    boardBounds();
    await user.click(screen.getByRole('button', { name: '가운데 붙이기' }));
    await user.type(screen.getByRole('textbox', { name: '스티키 내용' }), '메모{Enter}');
    await user.keyboard('{Escape}');
    boardBounds().focus();
    await user.keyboard('3');
    expect(store.board.stickies.s1.color).toBe('yellow');
    expect(screen.getByRole('button', { name: '파란색 포스트잇' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('uses the preset to change selected notes and shows external changes', async () => {
    const user = userEvent.setup();
    const store = memoryStore({
      stickies: {
        a: {
          id: 'a',
          kind: 'event',
          color: 'orange',
          text: 'Paid',
          x: 0,
          y: 0,
          z: 1,
          width: 160,
          height: 120,
        },
      },
    });
    render(<App store={store} newId={ids()} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: '도메인 이벤트: Paid' }), {
      button: 0,
    });
    await user.selectOptions(
      screen.getByRole('combobox', { name: '포스트잇 팔레트' }),
      'eventStorming',
    );
    expect(store.board.stickies.a.kind).toBe('event');
    await user.click(screen.getByRole('button', { name: '커맨드' }));
    expect(store.board.stickies.a).toMatchObject({ kind: 'command', color: 'blue' });
    act(() => store.push([{ op: 'set', id: 'a', field: 'text', value: 'Pay' }]));
    expect(screen.getByRole('button', { name: '커맨드: Pay' })).toBeInTheDocument();
    await user.keyboard('{Delete}');
    expect(store.board.stickies).toEqual({});
  });

  it('drops at the preview position after zooming and panning, then supports undo', async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    fireEvent.wheel(board, { clientX: 200, clientY: 80, deltaY: -Math.log(2) / 0.002 });
    fireEvent.pointerDown(board, { button: 1, clientX: 400, clientY: 200 });
    fireEvent.pointerMove(board, { clientX: 480, clientY: 240 });
    fireEvent.pointerUp(board);
    const swatch = startDrag('파란색 포스트잇');
    expect(store.board.stickies).toEqual({});
    expect(screen.getByText('놓아서 붙이기')).toHaveStyle({
      left: '180px',
      top: '60px',
      width: '160px',
      height: '160px',
    });
    drop(swatch);
    expect(store.board.stickies.s1).toMatchObject({
      x: 180,
      y: 60,
      kind: null,
      color: 'blue',
      width: 160,
      height: 160,
    });
    expect(screen.queryByText('놓아서 붙이기')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '스티키 내용' })).toHaveFocus();
    await user.type(screen.getByRole('textbox', { name: '스티키 내용' }), '발견한 점{Enter}');
    await user.keyboard('{Control>}z{/Control}{Control>}z{/Control}');
    expect(store.board.stickies).toEqual({});
  });

  it('does not add notes for outside drops, cancelled gestures or Escape', () => {
    const store = memoryStore();
    render(<App store={store} newId={ids()} />);
    boardBounds();
    drop(startDrag('초록색 포스트잇', 80, 40), 80, 40);
    const swatch = startDrag('초록색 포스트잇');
    fireEvent.pointerCancel(swatch);
    drop(swatch);
    startDrag('초록색 포스트잇');
    fireEvent.keyDown(swatch, { key: 'Escape' });
    drop(swatch);
    expect(store.board.stickies).toEqual({});
    expect(screen.queryByText('놓아서 붙이기')).not.toBeInTheDocument();
  });

  it('places one note by color click followed by a board click', async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    await user.click(screen.getByRole('button', { name: '분홍색 포스트잇' }));
    fireEvent.pointerDown(board, { button: 0, clientX: 600, clientY: 380 });
    fireEvent.pointerUp(board, { button: 0, clientX: 600, clientY: 380 });
    fireEvent.doubleClick(board, { clientX: 600, clientY: 380 });
    expect(Object.values(store.board.stickies)).toHaveLength(1);
    expect(store.board.stickies.s1).toMatchObject({
      color: 'pink',
      kind: null,
      x: 320,
      y: 220,
      width: 160,
      height: 160,
    });
  });

  it('provides a keyboard alternative to dragging and retains event storming roles', async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    render(<App store={store} newId={ids()} />);
    boardBounds();
    await user.selectOptions(
      screen.getByRole('combobox', { name: '포스트잇 팔레트' }),
      'eventStorming',
    );
    await user.click(screen.getByRole('button', { name: '가운데 붙이기' }));
    expect(store.board.stickies.s1).toMatchObject({
      kind: 'event',
      color: 'orange',
      x: 420,
      y: 280,
      width: 160,
      height: 160,
    });
    expect(screen.getByRole('button', { name: '도메인 이벤트: 빈 스티키' })).toBeInTheDocument();
  });

  it('drags a new color without recoloring the existing selection', () => {
    const store = memoryStore({
      stickies: {
        a: {
          id: 'a',
          color: 'orange',
          kind: 'event',
          text: '기존 메모',
          x: 0,
          y: 0,
          z: 1,
          width: 160,
          height: 120,
        },
      },
    });
    render(<App store={store} newId={ids()} />);
    boardBounds();
    fireEvent.pointerDown(screen.getByRole('button', { name: '도메인 이벤트: 기존 메모' }), {
      button: 0,
    });
    drop(startDrag('파란색 포스트잇'));
    expect(store.board.stickies.a).toMatchObject({ kind: 'event', color: 'orange' });
    expect(store.board.stickies.s1).toMatchObject({ kind: null, color: 'blue' });
  });

  it('selects notes with a marquee, recolors them together and undoes the change', async () => {
    const user = userEvent.setup();
    const store = memoryStore({
      stickies: {
        a: {
          id: 'a',
          color: 'yellow',
          kind: null,
          text: 'A',
          x: 40,
          y: 40,
          z: 1,
          width: 160,
          height: 120,
        },
        b: {
          id: 'b',
          color: 'yellow',
          kind: null,
          text: 'B',
          x: 240,
          y: 40,
          z: 2,
          width: 160,
          height: 120,
        },
      },
    });
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    fireEvent.pointerDown(board, { button: 0, shiftKey: true, clientX: 200, clientY: 80 });
    fireEvent.pointerMove(board, { clientX: 700, clientY: 300 });
    fireEvent.pointerUp(board);
    expect(screen.getByRole('button', { name: '노란색 포스트잇: A' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '노란색 포스트잇: B' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: '초록색 포스트잇' }));
    expect(Object.values(store.board.stickies).map((note) => note.color)).toEqual([
      'green',
      'green',
    ]);
    await user.keyboard('{Control>}z{/Control}');
    expect(Object.values(store.board.stickies).map((note) => note.color)).toEqual([
      'yellow',
      'yellow',
    ]);
  });
});
