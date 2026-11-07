// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { downloadText } from '../../../src/adapters/files/download';
import { parseBoard } from '../../../src/adapters/files/stormlet-format';
import { App } from '../../../src/app/App';
import { memoryStore, ids, boardBounds } from '../../support/app';
import { boardOf, sticky } from '../../support/boards';

const note = () => screen.getByRole('button', { name: /^도메인 이벤트:/ });
vi.mock('../../../src/adapters/files/download', async (original) => ({
  ...(await original<typeof import('../../../src/adapters/files/download')>()),
  downloadText: vi.fn(),
}));

describe('note editing experience', () => {
  it('keeps a chosen font size after reloading and editing the note', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(sticky('a', { autoFont: false, fontSize: 32 })));
    render(<App store={store} newId={ids()} />);
    boardBounds();
    expect(note().querySelector('p')).toHaveStyle({ fontSize: '32px' });
    await user.dblClick(note());
    fireEvent.change(screen.getByRole('textbox', { name: '스티키 내용' }), {
      target: { value: '고정 크기 유지' },
    });
    await user.keyboard('{Enter}');
    expect(store.board.stickies.a.text).toBe('고정 크기 유지');
    expect(note().querySelector('p')).toHaveStyle({ fontSize: '32px' });
  });

  it('exports the latest unfinished draft with Ctrl+S', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(sticky('a')));
    render(<App store={store} newId={ids()} />);
    boardBounds();
    await user.dblClick(note());
    fireEvent.change(screen.getByRole('textbox', { name: '스티키 내용' }), {
      target: { value: '저장할 최신 내용' },
    });
    await user.keyboard('{Control>}s{/Control}');
    expect(store.board.stickies.a.text).toBe('저장할 최신 내용');
    const saved = vi.mocked(downloadText).mock.calls.at(-1)!;
    expect(parseBoard(saved[1]).stickies.a.text).toBe('저장할 최신 내용');
  });
  it('starts typing directly from a selection and keeps Korean composition Enter inside the editor', () => {
    const store = memoryStore(boardOf(sticky('a', { text: '기존 내용' })));
    render(<App store={store} newId={ids()} />);
    boardBounds();
    fireEvent.pointerDown(note(), { button: 0 });
    fireEvent.pointerUp(note());
    fireEvent.keyDown(note(), { key: '새' });
    const editor = screen.getByRole('textbox', { name: '스티키 내용' });
    expect(editor).toHaveValue('새');
    fireEvent.compositionStart(editor);
    fireEvent.change(editor, { target: { value: '새로운 생각' } });
    fireEvent.keyDown(editor, { key: 'Enter', isComposing: true, keyCode: 229 });
    expect(editor).toHaveFocus();
    expect(store.board.stickies.a.text).toBe('기존 내용');
    fireEvent.compositionEnd(editor);
    fireEvent.keyDown(editor, { key: 'Enter', shiftKey: true });
    expect(editor).toHaveFocus();
    fireEvent.keyDown(editor, { key: 'Enter' });
    expect(store.board.stickies.a.text).toBe('새로운 생각');
    expect(note()).toHaveFocus();
  });

  it('applies text formatting, font size, shape and color through the contextual toolbar', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(sticky('a')));
    render(<App store={store} newId={ids()} />);
    boardBounds();
    await user.click(note());
    const toolbar = screen.getByRole('toolbar', { name: '포스트잇 편집 도구' });
    await user.click(within(toolbar).getByRole('button', { name: '굵게' }));
    await user.click(within(toolbar).getByRole('button', { name: '기울임' }));
    await user.click(within(toolbar).getByRole('button', { name: '밑줄' }));
    await user.selectOptions(within(toolbar).getByRole('combobox', { name: '글자 크기' }), '32');
    expect(store.board.stickies.a).toMatchObject({
      bold: true,
      italic: true,
      underline: true,
      autoFont: false,
      fontSize: 32,
    });
    expect(note().querySelector('p')).toHaveStyle({ fontSize: '32px' });
    await user.click(within(toolbar).getByRole('button', { name: '정렬과 배치' }));
    await user.click(screen.getByRole('button', { name: '왼쪽' }));
    expect(note().querySelector('p')).toHaveStyle({ textAlign: 'left' });
    await user.click(within(toolbar).getByRole('button', { name: '포스트잇 색 변경' }));
    await user.click(screen.getByRole('button', { name: '□ 정사각형' }));
    await user.click(screen.getByRole('button', { name: '청록색으로 변경' }));
    expect(store.board.stickies.a).toMatchObject({ color: 'teal', width: 160, height: 160 });
    await user.selectOptions(within(toolbar).getByRole('combobox', { name: '글자 크기' }), 'auto');
    expect(store.board.stickies.a.autoFont).toBe(true);
  });

  it('keeps the latest draft when duplicating or locking from the toolbar', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(sticky('a')));
    render(<App store={store} newId={ids()} />);
    boardBounds();
    await user.dblClick(note());
    fireEvent.change(screen.getByRole('textbox', { name: '스티키 내용' }), {
      target: { value: '입력 중인 내용' },
    });
    await user.click(screen.getByRole('button', { name: '포스트잇 복제' }));
    expect(store.board.stickies.a.text).toBe('입력 중인 내용');
    expect(store.board.stickies.s1.text).toBe('입력 중인 내용');
    const copy = screen.getAllByRole('button', { name: '도메인 이벤트: 입력 중인 내용' })[1];
    await user.dblClick(copy);
    fireEvent.change(screen.getByRole('textbox', { name: '스티키 내용' }), {
      target: { value: '잠글 내용' },
    });
    await user.click(screen.getByRole('button', { name: '포스트잇 잠금' }));
    expect(store.board.stickies.s1).toMatchObject({ text: '잠글 내용', locked: true });
    expect(screen.queryByRole('textbox', { name: '스티키 내용' })).not.toBeInTheDocument();
    await user.keyboard('{Delete}');
    expect(store.board.stickies.s1).toBeDefined();
    await user.click(screen.getByRole('button', { name: '잠금 해제' }));
    expect(store.board.stickies.s1.locked).toBe(false);
  });

  it('toggles reactions without a profile and searches note text', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(sticky('a', { text: '실험할 아이디어' })));
    render(<App store={store} newId={ids()} />);
    boardBounds();
    await user.click(note());
    await user.click(screen.getByRole('button', { name: '반응 추가' }));
    expect(screen.queryByRole('button', { name: '태그 편집' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: '작성자 표시' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '👍 반응' }));
    expect(store.board.stickies.a.reactions?.[0].people).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '👍 반응 1개' }));
    expect(store.board.stickies.a.reactions).toEqual([]);
    await user.click(screen.getByRole('button', { name: '메모 검색' }));
    await user.type(screen.getByRole('searchbox', { name: '메모 내용 검색' }), '실험');
    expect(screen.getByText('검색 결과 1개')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '검색 닫기' }));
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });
});
