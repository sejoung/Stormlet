// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../../../src/app/App';
import { parseBoard } from '../../../../src/adapters/files/stormlet-format';
import { downloadText } from '../../../../src/adapters/files/download';
import { boardBounds, ids, memoryStore } from '../../../support/app';
import { frame } from '../../../support/frames';
import { boardOf, sticky } from '../../../support/boards';

vi.mock('../../../../src/adapters/files/download', async (original) => ({
  ...(await original<typeof import('../../../../src/adapters/files/download')>()),
  downloadText: vi.fn(),
}));

describe('frame editing', () => {
  it('adds an empty transparent lane with a preset and edits, cancels and saves its title', async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    await user.click(screen.getByRole('button', { name: '프레임 도구' }));
    const panel = screen.getByRole('dialog', { name: '프레임 기본 설정' });
    await user.click(within(panel).getByRole('button', { name: '가로 레인' }));
    fireEvent.pointerDown(board, { button: 0, clientX: 300, clientY: 180 });
    fireEvent.pointerUp(board, { button: 0, clientX: 300, clientY: 180 });
    expect(store.board.frames?.s1).toMatchObject({
      x: 100,
      y: 100,
      width: 1200,
      height: 280,
      color: 'none',
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('왼쪽 포스트잇 도구나', { exact: false })).not.toBeInTheDocument();
    await user.dblClick(screen.getByRole('button', { name: '프레임: 프레임 1' }));
    const title = screen.getByRole('textbox', { name: '프레임 이름' });
    expect(title).toHaveFocus();
    await user.keyboard('고객{Enter}');
    expect(store.board.frames?.s1.title).toBe('고객');
    expect(screen.getByRole('button', { name: '프레임: 고객' })).toHaveFocus();
    await user.keyboard('{F2}');
    await user.type(screen.getByRole('textbox', { name: '프레임 이름' }), '취소{Escape}');
    expect(store.board.frames?.s1.title).toBe('고객');
    await user.dblClick(screen.getByRole('button', { name: '프레임: 고객' }));
    const input = screen.getByRole('textbox', { name: '프레임 이름' });
    fireEvent.change(input, { target: { value: '관리자' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true, keyCode: 229 });
    expect(input).toBeInTheDocument();
    expect(store.board.frames?.s1.title).toBe('고객');
    await user.keyboard('{Control>}s{/Control}');
    const saved = vi.mocked(downloadText).mock.calls.at(-1)!;
    expect(parseBoard(saved[1]).frames?.s1.title).toBe('관리자');
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: '실행 취소' }));
    expect(store.board.frames?.s1.title).toBe('고객');
  });

  it('changes fill and dimensions, locks the frame and keeps contained notes editable', async () => {
    const user = userEvent.setup();
    const store = memoryStore({
      ...boardOf(sticky('a', { x: 40, y: 40 })),
      frames: { frame: frame() },
    });
    render(<App store={store} newId={ids()} />);
    boardBounds();
    await user.click(screen.getByRole('button', { name: '프레임: 프레임 1' }));
    const toolbar = screen.getByRole('toolbar', { name: '프레임 편집 도구' });
    await user.click(within(toolbar).getByRole('button', { name: '파란색' }));
    expect(store.board.frames?.frame.color).toBe('blue');
    await user.click(within(toolbar).getByRole('button', { name: '배경 없음' }));
    expect(store.board.frames?.frame.color).toBe('none');
    const width = screen.getByRole('spinbutton', { name: '프레임 너비' });
    await user.clear(width);
    await user.type(width, '900{Enter}');
    expect(store.board.frames?.frame.width).toBe(900);
    expect(store.board.stickies.a.width).toBe(160);
    const height = screen.getByRole('spinbutton', { name: '프레임 높이' });
    await user.clear(height);
    await user.type(height, '1000{Escape}');
    expect(store.board.frames?.frame.height).toBe(400);
    await user.clear(height);
    await user.tab();
    expect(store.board.frames?.frame.height).toBe(400);
    await user.click(screen.getByRole('button', { name: '프레임 잠금' }));
    expect(screen.getByRole('button', { name: '프레임 삭제' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '프레임 크기 조절' })).not.toBeInTheDocument();
    await user.dblClick(screen.getByRole('button', { name: '프레임: 프레임 1' }));
    expect(screen.queryByRole('textbox', { name: '프레임 이름' })).not.toBeInTheDocument();
    await user.keyboard('{Delete}{ArrowRight}');
    expect(store.board.frames?.frame).toMatchObject({ locked: true, x: 0 });
    await user.dblClick(screen.getByRole('button', { name: '도메인 이벤트: a' }));
    await user.type(screen.getByRole('textbox', { name: '스티키 내용' }), '편집{Enter}');
    expect(store.board.stickies.a.text).toBe('a편집');
    expect(screen.queryByRole('toolbar', { name: '프레임 편집 도구' })).not.toBeInTheDocument();
  });

  it('wraps selected notes, commits unfinished text and deletes only the frame with undo', async () => {
    const user = userEvent.setup();
    const store = memoryStore(
      boardOf(sticky('a', { x: 100, y: 100 }), sticky('b', { x: 400, y: 100 })),
    );
    render(<App store={store} newId={ids()} />);
    boardBounds();
    await user.click(screen.getByRole('button', { name: '도메인 이벤트: a' }));
    await user.keyboard('{Control>}a{/Control}');
    await user.click(screen.getByRole('button', { name: '프레임 만들기' }));
    expect(store.board.frames?.s1).toMatchObject({ x: 68, y: 68, width: 524, height: 184 });
    await user.keyboard('{Delete}');
    expect(store.board.frames).toBeUndefined();
    expect(Object.keys(store.board.stickies)).toHaveLength(2);
    await user.keyboard('{Control>}z{/Control}');
    expect(store.board.frames?.s1).toBeDefined();
    await user.dblClick(screen.getByRole('button', { name: '도메인 이벤트: a' }));
    fireEvent.change(screen.getByRole('textbox', { name: '스티키 내용' }), {
      target: { value: '미완성 내용' },
    });
    await user.click(screen.getByRole('button', { name: '프레임 만들기' }));
    expect(store.board.stickies.a.text).toBe('미완성 내용');
    expect(Object.keys(store.board.frames ?? {})).toHaveLength(2);
  });

  it('copies and pastes a frame with independent contents and preserves native title clipboard events', async () => {
    const user = userEvent.setup();
    const store = memoryStore({
      ...boardOf(sticky('a', { x: 30, y: 40 })),
      frames: { frame: frame() },
    });
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    await user.click(screen.getByRole('button', { name: '프레임: 프레임 1' }));
    const values = new Map<string, string>();
    const clipboardData = {
      setData: (key: string, value: string) => values.set(key, value),
      getData: (key: string) => values.get(key) ?? '',
    };
    expect(fireEvent.copy(board, { clipboardData })).toBe(false);
    expect(parseBoard(values.get('application/x-stormlet')!).frames?.frame).toEqual(frame());
    expect(fireEvent.paste(board, { clipboardData })).toBe(false);
    expect(Object.keys(store.board.frames!)).toHaveLength(2);
    expect(Object.keys(store.board.stickies)).toHaveLength(2);
    const copy = Object.values(store.board.frames!).find((item) => item.id !== 'frame')!;
    expect(copy).toMatchObject({ x: 180, y: 150 });
    expect(fireEvent.cut(board, { clipboardData })).toBe(false);
    expect(Object.keys(store.board.frames!)).toEqual(['frame']);
    expect(Object.keys(store.board.stickies)).toEqual(['a']);
    expect(fireEvent.paste(board, { clipboardData })).toBe(false);
    expect(Object.keys(store.board.frames!)).toHaveLength(2);
    await user.dblClick(screen.getByRole('button', { name: '프레임: 프레임 1', pressed: true }));
    expect(
      fireEvent.copy(screen.getByRole('textbox', { name: '프레임 이름' }), { clipboardData }),
    ).toBe(true);
  });
});
