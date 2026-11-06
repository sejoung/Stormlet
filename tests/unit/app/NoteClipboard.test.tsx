// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../../src/app/App';
import { memoryStore, ids, boardBounds } from '../../support/app';
import { boardOf, sticky } from '../../support/boards';

function clipboard(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getData: (type: string) => data.get(type) ?? '',
    setData: (type: string, value: string) => {
      data.set(type, value);
    },
  };
}

describe('bulk entry and clipboard', () => {
  it('previews multiple lines, creates all notes as one undo step and traps dialog focus', async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    render(<App store={store} newId={ids()} />);
    boardBounds();
    await user.click(screen.getByRole('button', { name: '여러 개 한 번에' }));
    const editor = screen.getByRole('textbox', { name: '포스트잇 여러 개 입력' });
    expect(editor).toHaveFocus();
    await user.type(editor, '첫 번째 생각{Enter}{Enter}두 번째 생각');
    expect(screen.getByRole('status')).toHaveTextContent('2개의 포스트잇');
    await user.click(screen.getByRole('button', { name: '보드에 붙이기' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(Object.values(store.board.stickies).map((s) => s.text)).toEqual([
      '첫 번째 생각',
      '두 번째 생각',
    ]);
    expect(store.board.stickies.s2.x).toBeGreaterThan(store.board.stickies.s1.x);
    expect(
      Object.values(store.board.stickies).every(
        (note) => note.width === 160 && note.height === 160,
      ),
    ).toBe(true);
    await user.keyboard('{Control>}z{/Control}');
    expect(store.board.stickies).toEqual({});
  });

  it('copies and pastes the full selected notes with independent groups and preserves native text paste', async () => {
    const user = userEvent.setup();
    const store = memoryStore(
      boardOf(
        sticky('a', { bold: true, color: 'teal', tags: ['todo'], groupId: 'original' }),
        sticky('b', { x: 200, groupId: 'original' }),
      ),
    );
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    await user.click(screen.getByRole('button', { name: '도메인 이벤트: a' }));
    const data = clipboard();
    expect(fireEvent.copy(board, { clipboardData: data })).toBe(false);
    expect(data.getData('text/plain')).toBe('a\nb');
    expect(fireEvent.paste(board, { clipboardData: data })).toBe(false);
    const copies = Object.values(store.board.stickies).filter((s) => !['a', 'b'].includes(s.id));
    expect(copies).toHaveLength(2);
    expect(copies[0]).toMatchObject({ bold: true, color: 'teal', tags: ['todo'] });
    expect(copies[0].groupId).toBe(copies[1].groupId);
    expect(copies[0].groupId).not.toBe('original');
    await user.dblClick(screen.getAllByRole('button', { name: '도메인 이벤트: a' })[1]);
    const editor = screen.getByRole('textbox', { name: '스티키 내용' });
    expect(
      fireEvent.paste(editor, { clipboardData: clipboard({ 'text/plain': '그대로 입력' }) }),
    ).toBe(true);
    expect(Object.keys(store.board.stickies)).toHaveLength(4);
  });

  it('turns spreadsheet cells into separate notes with their row and column positions', () => {
    const store = memoryStore();
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    fireEvent.paste(board, { clipboardData: clipboard({ 'text/plain': 'A\tB\nC\t"두 줄\n셀"' }) });
    const [a, b, c, d] = Object.values(store.board.stickies);
    expect([a, b, c, d].every((note) => note.width === 160 && note.height === 160)).toBe(true);
    expect([a.text, b.text, c.text, d.text]).toEqual(['A', 'B', 'C', '두 줄\n셀']);
    expect(a.y).toBe(b.y);
    expect(a.x).toBe(c.x);
    expect(b.x).toBe(d.x);
    expect(c.y).toBe(d.y);
  });

  it('cuts selected notes, handles invalid structured data and leaves the board intact on failure', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(sticky('a')));
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    await user.click(screen.getByRole('button', { name: '도메인 이벤트: a' }));
    const data = clipboard();
    fireEvent.cut(board, { clipboardData: data });
    expect(store.board.stickies).toEqual({});
    fireEvent.paste(board, { clipboardData: clipboard({ 'application/x-stormlet': 'bad json' }) });
    expect(store.board.stickies).toEqual({});
    expect(screen.getByRole('status')).toHaveTextContent('붙여넣을 수 없습니다');
    fireEvent.paste(board, { clipboardData: data });
    expect(Object.values(store.board.stickies)[0].text).toBe('a');
  });
});
