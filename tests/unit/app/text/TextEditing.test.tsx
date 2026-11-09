// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../../../src/app/App';
import { boardBounds, ids, memoryStore } from '../../../support/app';
import { boardOf, sticky } from '../../../support/boards';

const original = () =>
  sticky('a', {
    objectType: 'text',
    text: '기존 제목',
    textAlign: 'left',
    autoFont: false,
    fontSize: 24,
    width: 320,
    height: 100,
  });
const textObject = () => screen.getByRole('button', { name: /^텍스트:/ });
const editor = () => screen.getByRole('textbox', { name: '텍스트 내용' });

describe('standalone text editing', () => {
  it('creates text with T at the clicked point, accepts newlines and commits without a new note', async () => {
    const user = userEvent.setup();
    const store = memoryStore();
    render(<App store={store} newId={ids()} />);
    const board = boardBounds();
    await user.keyboard('t');
    expect(screen.getByRole('button', { name: '텍스트 도구' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.pointerDown(board, { button: 0, clientX: 500, clientY: 280 });
    fireEvent.pointerUp(board, { clientX: 500, clientY: 280 });
    expect(editor()).toHaveFocus();
    await user.type(editor(), '제목{Enter}설명');
    expect(editor()).toHaveValue('제목\n설명');
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(store.board.stickies.s1).toMatchObject({
      objectType: 'text',
      text: '제목\n설명',
      x: 300,
      y: 200,
      textAlign: 'left',
      autoFont: true,
    });
    expect(screen.getByRole('combobox', { name: '글자 크기' })).toHaveValue('auto');
    expect(Object.keys(store.board.stickies)).toHaveLength(1);
    expect(textObject()).toHaveStyle({ background: 'transparent' });
    expect(textObject()).toHaveClass('is-text');
    expect(screen.getByRole('button', { name: '선택 · 이동' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('formats text, edits with Korean composition, and preserves intentional whitespace', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(original()));
    render(<App store={store} newId={ids()} />);
    boardBounds();
    await user.dblClick(textObject());
    const input = editor();
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '  한글 제목\n설명' } });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true, isComposing: true, keyCode: 229 });
    expect(input).toHaveFocus();
    expect(store.board.stickies.a.text).toBe('기존 제목');
    fireEvent.compositionEnd(input);
    await user.keyboard('{Escape}');
    expect(store.board.stickies.a.text).toBe('  한글 제목\n설명');
    const toolbar = screen.getByRole('toolbar', { name: '텍스트 편집 도구' });
    for (const label of ['굵게', '기울임', '밑줄'])
      await user.click(within(toolbar).getByRole('button', { name: label }));
    await user.selectOptions(within(toolbar).getByRole('combobox', { name: '글자 크기' }), '32');
    await user.click(within(toolbar).getByRole('button', { name: '글자 색상' }));
    expect(screen.queryByText('□ 정사각형')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '글자 색상: 파랑' }));
    await user.click(within(toolbar).getByRole('button', { name: '텍스트 정렬' }));
    await user.click(screen.getByRole('button', { name: '오른쪽' }));
    expect(store.board.stickies.a).toMatchObject({
      objectType: 'text',
      bold: true,
      italic: true,
      underline: true,
      fontSize: 32,
      textColor: 'blue',
      textAlign: 'right',
    });
    expect(textObject().querySelector('p')).toHaveStyle({
      textAlign: 'right',
      textDecoration: 'underline',
    });
  });

  it('duplicates the latest draft and supports undo, lock, and empty-text cleanup', async () => {
    const user = userEvent.setup();
    const store = memoryStore(boardOf(original()));
    render(<App store={store} newId={ids()} />);
    boardBounds();
    await user.dblClick(textObject());
    fireEvent.change(editor(), { target: { value: '작성 중' } });
    await user.click(screen.getByRole('button', { name: '텍스트 복제' }));
    expect(store.board.stickies.s1).toMatchObject({ objectType: 'text', text: '작성 중' });
    await user.click(screen.getByRole('button', { name: '텍스트 잠금' }));
    await user.keyboard('{Delete}');
    expect(store.board.stickies.s1.locked).toBe(true);
    await user.click(screen.getByRole('button', { name: '잠금 해제' }));
    await user.dblClick(screen.getAllByRole('button', { name: /^텍스트:/ })[1]);
    fireEvent.change(editor(), { target: { value: '  ' } });
    await user.keyboard('{Escape}');
    expect(store.board.stickies.s1).toBeUndefined();
    await user.keyboard('{Control>}z{/Control}');
    expect(store.board.stickies.s1).toMatchObject({ objectType: 'text', text: '작성 중' });
  });

  it('opens an existing text with a single click while the text tool is active', async () => {
    const user = userEvent.setup();
    render(<App store={memoryStore(boardOf(original()))} newId={ids()} />);
    boardBounds();
    await user.click(screen.getByRole('button', { name: '텍스트 도구' }));
    await user.click(textObject());
    expect(editor()).toHaveFocus();
    expect(editor()).toHaveValue('기존 제목');
  });
});
