// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../src/app/App';
import { StickyText } from '../../../src/components/board/NoteContent';
import { memoryStore, ids, boardBounds } from '../../support/app';
import { boardOf, sticky } from '../../support/boards';

const note = () => screen.getByRole('button', { name: /도메인 이벤트/ });

function selectedNote() {
  const store = memoryStore(boardOf(sticky('a', { text: '기존 내용' })));
  render(<App store={store} newId={ids()} />);
  boardBounds();
  fireEvent.pointerDown(note(), { button: 0 });
  fireEvent.pointerUp(note());
  return store;
}

describe('typing on a selected note with an IME', () => {
  it.each([
    ['an IME already composing', { key: 'Process', keyCode: 229 }],
    ['a lone jamo', { key: 'ㅅ', keyCode: 83 }],
  ])('opens an empty, focused editor for %s, without seeding the key', (_, key) => {
    const store = selectedNote();
    fireEvent.keyDown(note(), key);
    const editor = screen.getByRole('textbox', { name: '스티키 내용' });
    expect(editor).toHaveValue('');
    expect(editor).toHaveFocus();
    // The IME then composes the syllable in the editor.
    fireEvent.compositionStart(editor);
    fireEvent.change(editor, { target: { value: '새' } });
    fireEvent.compositionEnd(editor);
    fireEvent.keyDown(editor, { key: 'Enter' });
    expect(store.board.stickies.a.text).toBe('새');
  });

  it('still starts with the typed character for keys outside a composition', () => {
    selectedNote();
    fireEvent.keyDown(note(), { key: 'a' });
    expect(screen.getByRole('textbox', { name: '스티키 내용' })).toHaveValue('a');
  });
});

describe('text fitting while a resize previews', () => {
  afterEach(() => vi.restoreAllMocks());

  /** A layout where text is 3 lines tall and always 100px wide, counting each measurement. */
  function fakeLayout() {
    const reads = { count: 0 };
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      reads.count++;
      return parseFloat(this.style.fontSize) * 3.45;
    });
    return reads;
  }
  const fontOf = (container: HTMLElement) =>
    (container.querySelector('.sticky-text') as HTMLElement).style.fontSize;

  it('measures once per frame, and commits the same font a normal fit finds', async () => {
    const reads = fakeLayout();
    const text = sticky('a', { text: 'Long enough text' });
    const { container, rerender } = render(
      <StickyText note={text} size={{ width: 160, height: 120 }} />,
    );
    for (const height of [140, 160, 180, 200]) {
      const before = reads.count;
      rerender(<StickyText note={text} size={{ width: 160, height }} live />);
      expect(reads.count).toBe(before);
    }
    await act(() => new Promise(requestAnimationFrame));
    const measured = reads.count;
    expect(measured).toBeGreaterThan(0);
    // Committing the size the preview ended on needs no new measurement.
    rerender(<StickyText note={text} size={{ width: 160, height: 200 }} />);
    expect(reads.count).toBe(measured);
    const committed = fontOf(container);
    const fresh = render(<StickyText note={text} size={{ width: 160, height: 200 }} />);
    expect(fontOf(fresh.container)).toBe(committed);
    // A commit to a size never measured during the preview is fitted right away.
    rerender(<StickyText note={text} size={{ width: 160, height: 220 }} live />);
    rerender(<StickyText note={text} size={{ width: 160, height: 120 }} />);
    expect(reads.count).toBeGreaterThan(measured);
    expect(fontOf(container)).toBe(
      fontOf(render(<StickyText note={text} size={{ width: 160, height: 120 }} />).container),
    );
  });
});
