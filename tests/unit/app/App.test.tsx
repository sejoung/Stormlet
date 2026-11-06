// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../../src/app/App';
import { memoryStore, ids, boardBounds } from '../../support/app';
import { boardOf, sticky } from '../../support/boards';

describe('App', () => {
  it('removes both palettes, the profile and metadata controls while keeping creation tools', async () => {
    const user = userEvent.setup();
    render(<App store={memoryStore()} newId={ids()} />);
    boardBounds();
    expect(screen.queryByRole('combobox', { name: '포스트잇 팔레트' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: '포스트잇 색상' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '작성자 이름' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '포스트잇 도구' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '가운데 붙이기' }));
    expect(screen.queryByRole('button', { name: '태그 편집' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: '작성자 표시' })).not.toBeInTheDocument();
  });

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

  it('adds a square note at the center, edits its text and undoes both steps', async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    render(<App store={store} newId={ids()} />);
    boardBounds();
    await user.click(screen.getByRole('button', { name: '가운데 붙이기' }));
    await user.type(screen.getByRole('textbox', { name: '스티키 내용' }), '새 아이디어{Enter}');
    expect(store.board.stickies.s1).toMatchObject({
      text: '새 아이디어',
      kind: null,
      color: 'yellow',
      width: 160,
      height: 160,
      x: 420,
      y: 280,
    });
    await user.keyboard('{Control>}z{/Control}');
    expect(screen.getByRole('button', { name: '노란색 포스트잇: 빈 스티키' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '실행 취소' }));
    expect(store.board.stickies).toEqual({});
    await user.click(screen.getByRole('button', { name: '다시 실행' }));
    expect(Object.keys(store.board.stickies)).toEqual(['s1']);
  });

  it('recolors a legacy note through its toolbar without changing its meaning and receives external edits', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(sticky('a', { text: 'Paid' })));
    render(<App store={store} newId={ids()} />);
    boardBounds();
    await user.click(screen.getByRole('button', { name: '도메인 이벤트: Paid' }));
    await user.click(screen.getByRole('button', { name: '포스트잇 색 변경' }));
    await user.click(screen.getByRole('button', { name: '파란색으로 변경' }));
    expect(store.board.stickies.a).toMatchObject({ kind: 'event', color: 'blue' });
    act(() => store.push([{ op: 'set', id: 'a', field: 'text', value: 'Pay' }]));
    expect(screen.getByRole('button', { name: '도메인 이벤트: Pay' })).toBeInTheDocument();
    await user.keyboard('{Delete}');
    expect(store.board.stickies).toEqual({});
  });

  it('places a note with N at the right position after zooming and panning', async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    fireEvent.wheel(board, { clientX: 200, clientY: 80, deltaY: -Math.log(2) / 0.002 });
    fireEvent.pointerDown(board, { button: 1, clientX: 400, clientY: 200 });
    fireEvent.pointerMove(board, { clientX: 480, clientY: 240 });
    fireEvent.pointerUp(board);
    board.focus();
    await user.keyboard('n');
    fireEvent.pointerDown(board, { button: 0, clientX: 800, clientY: 400 });
    fireEvent.pointerUp(board, { button: 0, clientX: 800, clientY: 400 });
    expect(store.board.stickies.s1).toMatchObject({
      x: 180,
      y: 60,
      kind: null,
      color: 'yellow',
      width: 160,
      height: 160,
    });
    expect(screen.getByRole('textbox', { name: '스티키 내용' })).toHaveFocus();
    await user.type(screen.getByRole('textbox', { name: '스티키 내용' }), '발견한 점{Enter}');
    await user.keyboard('{Control>}z{/Control}{Control>}z{/Control}');
    expect(store.board.stickies).toEqual({});
  });

  it('cancels placement with Escape and creates only one note from the tool click', async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    await user.click(screen.getByRole('button', { name: '포스트잇 도구' }));
    fireEvent.pointerDown(board, { button: 0, clientX: 600, clientY: 380 });
    fireEvent.keyDown(board, { key: 'Escape' });
    fireEvent.pointerUp(board, { clientX: 600, clientY: 380 });
    expect(store.board.stickies).toEqual({});
    await user.click(screen.getByRole('button', { name: '포스트잇 도구' }));
    fireEvent.pointerDown(board, { button: 0, clientX: 600, clientY: 380 });
    fireEvent.pointerUp(board, { button: 0, clientX: 600, clientY: 380 });
    fireEvent.doubleClick(board, { clientX: 600, clientY: 380 });
    expect(Object.values(store.board.stickies)).toHaveLength(1);
    expect(store.board.stickies.s1).toMatchObject({ x: 320, y: 220, width: 160, height: 160 });
  });

  it('recolors a marquee selection together and undoes the change', async () => {
    const user = userEvent.setup();
    const store = memoryStore(
      boardOf(
        sticky('a', { kind: null, color: 'yellow', text: 'A', x: 40, y: 40 }),
        sticky('b', { kind: null, color: 'yellow', text: 'B', x: 240, y: 40, z: 2 }),
      ),
    );
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
    await user.click(screen.getByRole('button', { name: '포스트잇 색 변경' }));
    await user.click(screen.getByRole('button', { name: '초록색으로 변경' }));
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
