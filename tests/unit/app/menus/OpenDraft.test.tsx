// @vitest-environment jsdom
import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../../../src/app/App';
import { contains } from '../../../../src/domain/frames/model';
import { memoryStore, ids, boardBounds } from '../../../support/app';
import { boardOf, sticky } from '../../../support/boards';

/** A board file an AI could write: frames and notes with no coordinates (ADR 0017). */
const DRAFT = JSON.stringify({
  format: 'stormlet',
  version: 12,
  title: 'KPT',
  frames: [{ id: 'keep', title: 'Keep' }],
  stickies: [
    { id: 'k1', frame: 'keep', text: '배포 자동화' },
    { id: 'k2', frame: 'keep', text: '빠른 리뷰' },
  ],
  connections: [{ from: 'k1', to: 'k2' }],
});

function clipboard(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial));
  return { getData: (type: string) => data.get(type) ?? '', setData: () => {} };
}

/** jsdom's File has no text(); the browser's does. */
function boardFile(content: string, name: string) {
  const file = new File([content], name);
  Object.defineProperty(file, 'text', { value: async () => content });
  return file;
}

const filesDrag = (files: File[] = []) => ({ dataTransfer: { types: ['Files'], files } });

describe('opening AI-written boards', () => {
  it('opens a dropped draft file laid out, as one undoable step', async () => {
    const store = memoryStore(boardOf(sticky('old')));
    render(<App store={store} newId={ids()} />);
    fireEvent.dragEnter(window, filesDrag());
    expect(screen.getByText('놓으면 보드 파일을 엽니다')).toBeInTheDocument();
    const drop = createEvent.drop(window, filesDrag([boardFile(DRAFT, 'kpt.stormlet')]));
    fireEvent(window, drop);
    expect(drop.defaultPrevented).toBe(true);
    expect(await screen.findByText('kpt.stormlet을(를) 열었습니다.')).toBeInTheDocument();
    expect(screen.queryByText('놓으면 보드 파일을 엽니다')).not.toBeInTheDocument();
    const { stickies, frames, connections, title } = store.board;
    expect(title).toBe('KPT');
    expect(contains(frames!.keep, stickies.k1)).toBe(true);
    expect(contains(frames!.keep, stickies.k2)).toBe(true);
    expect(Object.keys(connections!)).toHaveLength(1);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    await waitFor(() => expect(Object.keys(store.board.stickies)).toEqual(['old']));
  });

  it('hides the hint when the drag leaves and ignores drags without files', () => {
    render(<App store={memoryStore()} newId={ids()} />);
    fireEvent.dragEnter(window, filesDrag());
    fireEvent.dragLeave(window, filesDrag());
    expect(screen.queryByText('놓으면 보드 파일을 엽니다')).not.toBeInTheDocument();
    const text = { dataTransfer: { types: ['text/plain'], files: [] } };
    fireEvent.dragEnter(window, text);
    expect(screen.queryByText('놓으면 보드 파일을 엽니다')).not.toBeInTheDocument();
    const drop = createEvent.drop(window, text);
    fireEvent(window, drop);
    expect(drop.defaultPrevented).toBe(false);
  });

  it('opens a board file pasted as text, with or without a code fence', async () => {
    const store = memoryStore(boardOf(sticky('old')));
    render(<App store={store} newId={ids()} />);
    boardBounds();
    const board = document.querySelector('.board')!;
    const fenced = `\`\`\`json\n${DRAFT}\n\`\`\``;
    fireEvent.paste(board, { clipboardData: clipboard({ 'text/plain': fenced }) });
    expect(
      await screen.findByText('붙여넣은 보드를 열었습니다. 실행 취소하면 이전 보드로 돌아갑니다.'),
    ).toBeInTheDocument();
    expect(Object.keys(store.board.stickies).sort()).toEqual(['k1', 'k2']);
  });

  it('keeps the board when pasted board text is malformed, and other text still makes notes', async () => {
    const store = memoryStore(boardOf(sticky('old')));
    render(<App store={store} newId={ids()} />);
    boardBounds();
    const board = document.querySelector('.board')!;
    const broken = '{"format": "stormlet", "version": 12, "stickies": [{"text": "no id"}]}';
    fireEvent.paste(board, { clipboardData: clipboard({ 'text/plain': broken }) });
    expect(await screen.findByText(/열 수 없는 파일입니다/)).toBeInTheDocument();
    expect(Object.keys(store.board.stickies)).toEqual(['old']);
    fireEvent.paste(board, { clipboardData: clipboard({ 'text/plain': '{"format": "other"}' }) });
    await waitFor(() => expect(Object.keys(store.board.stickies)).toHaveLength(2));
  });
});
