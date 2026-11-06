import { useCallback, useMemo, useRef, useState } from 'react';
import {
  addSticky,
  bringToFront,
  deleteStickies,
  moveStickies,
  setAppearance,
  setColor,
  setText,
  type Move,
} from '../domain/commands';
import { own } from '../domain/ids';
import type { StickyAppearance } from '../domain/model';
import { diffBoards } from '../domain/patch';
import type { BoardStore } from '../domain/store';
import { centeredAt } from '../engine/sticky-metrics';
import {
  INITIAL_VIEW,
  toBoardPoint,
  zoomAround,
  ZOOM_STEP,
  type Point,
  type View,
} from '../engine/viewport';
import { BoardCanvas } from '../components/board/BoardCanvas';
import { paletteEntries, type BoardTool, type PaletteMode } from '../components/board/kinds';
import { Toolbar } from '../components/toolbar/Toolbar';
import { StickyPalette, type PaletteDraft } from '../components/toolbar/StickyPalette';
import { downloadText, readFileText } from '../adapters/files/download';
import { FILE_EXTENSION, parseBoard, serializeBoard } from '../adapters/files/stormlet-format';
import { useBoardSession } from './useBoardSession';
import { useShortcuts } from './useShortcuts';

interface Props {
  store: BoardStore;
  newId(): string;
}

export function App({ store, newId }: Props) {
  const { session, edit, undo, redo } = useBoardSession(store);
  const { board } = session;
  const boardElement = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const [mode, setMode] = useState<PaletteMode>('free');
  const [appearance, setCurrentAppearance] = useState<StickyAppearance>({
    color: 'yellow',
    kind: null,
  });
  const [tool, setTool] = useState<BoardTool>('select');
  const [draft, setDraft] = useState<PaletteDraft | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const entries = useMemo(() => paletteEntries(mode), [mode]);
  const selection = useMemo(
    () => new Set(picked.filter((id) => own(board.stickies, id))),
    [picked, board],
  );

  const onPick = useCallback(
    (next: StickyAppearance) => {
      setCurrentAppearance(next);
      if (selection.size)
        edit((current) =>
          mode === 'free'
            ? setColor(current, [...selection], next.color)
            : setAppearance(current, [...selection], next),
        );
      else setTool('sticky');
    },
    [selection, edit, mode],
  );

  const onAdd = (at: Point, next = appearance) => {
    const id = newId();
    edit((current) => addSticky(current, { id, ...next, ...centeredAt(at) }));
    setPicked([]);
    setEditing(id);
    setTool('select');
  };

  const onDrop = ({ point, appearance: next }: PaletteDraft) => {
    const rect = boardElement.current!.getBoundingClientRect();
    if (
      point.x < rect.left ||
      point.x >= rect.right ||
      point.y < rect.top ||
      point.y >= rect.bottom
    )
      return;
    setCurrentAppearance(next);
    onAdd(toBoardPoint(view, { x: point.x - rect.left, y: point.y - rect.top }), next);
  };

  const onMove = useCallback(
    (moves: Move[]) =>
      edit((current) => [
        ...bringToFront(
          current,
          moves.map(({ id }) => id),
        ),
        ...moveStickies(current, moves),
      ]),
    [edit],
  );

  const onCommitText = useCallback(
    (id: string, text: string) => {
      setEditing(null);
      edit((current) => setText(current, id, text));
    },
    [edit],
  );

  const onOpen = async (file: File) => {
    try {
      const opened = parseBoard(await readFileText(file));
      edit((current) => diffBoards(current, opened));
      setPicked([]);
      setEditing(null);
      setStatus(`${file.name}을(를) 열었습니다.`);
    } catch (error) {
      setStatus(`열 수 없는 파일입니다: ${(error as Error).message}`);
    }
  };

  const shortcuts = useMemo(
    () => ({
      onUndo: undo,
      onRedo: redo,
      onDelete: () => edit((current) => deleteStickies(current, [...selection])),
      onPalette: (index: number) => onPick(entries[index]),
      onTool: setTool,
      onEscape: () => {
        setPicked([]);
        setTool('select');
        setDraft(null);
      },
    }),
    [undo, redo, edit, selection, onPick, entries],
  );
  useShortcuts(shortcuts);

  const center = (): Point => {
    const rect = boardElement.current!.getBoundingClientRect();
    return { x: rect.width / 2, y: rect.height / 2 };
  };

  return (
    <div className="app">
      <Toolbar
        mode={mode}
        canUndo={session.undo.length > 0}
        canRedo={session.redo.length > 0}
        status={status}
        onMode={(next) => {
          setMode(next);
          setCurrentAppearance(paletteEntries(next)[0]);
          setTool('select');
        }}
        onUndo={undo}
        onRedo={redo}
        onOpen={onOpen}
        onSave={() => downloadText(`board${FILE_EXTENSION}`, serializeBoard(board))}
      />
      <main className="workspace">
        <StickyPalette
          entries={entries}
          appearance={appearance}
          tool={tool}
          onTool={setTool}
          onPick={onPick}
          onDraft={setDraft}
          onDrop={onDrop}
          onAddCenter={() => onAdd(toBoardPoint(view, center()))}
        />
        <div className="canvas-area">
          <BoardCanvas
            board={board}
            view={view}
            selection={selection}
            editing={editing}
            element={boardElement}
            tool={tool}
            draft={draft}
            onViewChange={setView}
            onSelect={setPicked}
            onMove={onMove}
            onAdd={onAdd}
            onStartEdit={setEditing}
            onCommitText={onCommitText}
          />
          {Object.keys(board.stickies).length === 0 && (
            <div className="empty-hint">
              <span className="empty-eyebrow">작은 메모에서 시작하는 생각</span>
              <h1>생각 하나, 붙여 볼까요?</h1>
              <p>왼쪽 포스트잇을 보드로 끌어다 놓으세요.</p>
              <span>빈 곳을 더블클릭해도 좋아요.</span>
            </div>
          )}
          <div className="board-footer">
            <span className="board-help">
              {tool === 'sticky'
                ? '원하는 곳을 클릭해 붙이기 · Esc 취소'
                : tool === 'pan'
                  ? '배경을 드래그해 이동 · V 선택'
                  : '드래그로 선택 · H 이동 · 휠로 확대'}
            </span>
            <div className="zoom-controls" role="group" aria-label="확대 및 축소">
              <button
                type="button"
                aria-label="축소"
                onClick={() => setView(zoomAround(view, view.zoom / ZOOM_STEP, center()))}
              >
                −
              </button>
              <button
                type="button"
                aria-label="확대 비율 초기화"
                onClick={() => setView(zoomAround(view, 1, center()))}
              >
                {Math.round(view.zoom * 100)}%
              </button>
              <button
                type="button"
                aria-label="확대"
                onClick={() => setView(zoomAround(view, view.zoom * ZOOM_STEP, center()))}
              >
                +
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
