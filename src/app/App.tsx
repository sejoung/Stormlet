import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addSticky,
  bringToFront,
  deleteStickies,
  moveStickies,
  resizeStickies,
  sendToBack,
  setColor,
  setText,
  type Move,
} from '../domain/commands';
import type { StickySize } from '../domain/sticky-size';
import { StickyContextMenu } from '../components/board/StickyContextMenu';
import { own } from '../domain/ids';
import { DEFAULT_STICKY_APPEARANCE } from '../domain/model';
import { boardTitle, boardFileStem, normalizeBoardTitle } from '../domain/board-title';
import { diffBoards } from '../domain/patch';
import type { BoardStore } from '../domain/store';
import { centeredAt } from '../engine/sticky-metrics';
import { INITIAL_VIEW, toBoardPoint, zoomAround, type Point, type View } from '../engine/viewport';
import { BoardCanvas } from '../components/board/BoardCanvas';
import type { BoardTool } from '../components/board/kinds';
import { Toolbar } from '../components/toolbar/Toolbar';
import { CreationToolbar } from '../components/toolbar/CreationToolbar';
import { downloadText, readFileText } from '../adapters/files/download';
import { FILE_EXTENSION, parseBoard, serializeBoard } from '../adapters/files/stormlet-format';
import { useBoardSession } from './useBoardSession';
import { useShortcuts } from './useShortcuts';
import { useNoteActions } from './useNoteActions';
import { useClipboard } from './useClipboard';
import { reactionIdentity } from '../adapters/storage/web-storage';
import { fitView } from '../engine/fit-view';
import { SelectionToolbar } from '../components/selection/SelectionToolbar';
import { BulkDialog } from '../components/dialogs/BulkDialog';
import { HelpDialog } from '../components/dialogs/HelpDialog';
import { BoardSearch } from '../components/toolbar/BoardSearch';
import { BoardChrome } from '../components/board/BoardChrome';
import { updateNotes } from '../domain/note-actions';
import { useConnectionSession } from './useConnectionSession';
import { ConnectionToolbar } from '../components/connections/ConnectionToolbar';
import { connectionGeometry } from '../engine/connections/geometry';

interface Props {
  store: BoardStore;
  newId(): string;
}

export function App({ store, newId }: Props) {
  const { session, edit, undo, redo } = useBoardSession(store);
  const { board } = session;
  const boardElement = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const [tool, setTool] = useState<BoardTool>('interact');
  const [picked, setPicked] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [seed, setSeed] = useState<string | undefined>();
  const [reactor] = useState(reactionIdentity);
  const [dialog, setDialog] = useState<'bulk' | 'help' | null>(null);
  const closeDialog = useCallback(() => setDialog(null), []);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<{ ids: string[]; point: Point } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const [status, setStatus] = useState<string | null>(null);
  const links = useConnectionSession({
    board,
    edit,
    newId,
    clearNotes: () => setPicked([]),
    onTool: () => setTool('interact'),
    onStatus: setStatus,
  });
  const clearConnection = links.clear;
  const selectNotes = (ids: string[]) => {
    links.clear();
    setPicked(ids);
  };
  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), 5000);
    return () => window.clearTimeout(timer);
  }, [status]);
  const selection = useMemo(
    () => new Set(picked.filter((id) => own(board.stickies, id))),
    [picked, board],
  );
  const activeIds = editing && own(board.stickies, editing) ? [editing] : [...selection];
  const selectedNotes = activeIds.map((id) => board.stickies[id]);
  const matches = query.trim()
    ? Object.values(board.stickies).filter((note) =>
        note.text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
      )
    : Object.values(board.stickies);
  const center = (): Point => {
    const rect = boardElement.current!.getBoundingClientRect();
    return { x: rect.width / 2, y: rect.height / 2 };
  };
  const actions = useNoteActions({
    board,
    ids: activeIds,
    reactor,
    newId,
    edit,
    onSelect: selectNotes,
    onStatus: setStatus,
    center: () => toBoardPoint(view, center()),
  });
  const remove = () =>
    links.selected ? links.remove() : edit((current) => deleteStickies(current, activeIds));
  useClipboard({
    board,
    ids: activeIds,
    onPaste: actions.pasteNotes,
    onText: actions.addCells,
    onCut: remove,
    onStatus: setStatus,
  });
  const fit = (ids?: string[]) => {
    const rect = boardElement.current!.getBoundingClientRect();
    const next = fitView(
      [
        ...Object.values(board.stickies).filter((s) => !ids || ids.includes(s.id)),
        ...Object.values(board.connections ?? {})
          .filter((line) => !ids || links.selectedId === line.id)
          .flatMap((line) => connectionGeometry(board, line)?.bounds ?? []),
      ],
      rect.width,
      rect.height,
    );
    if (next) setView(next);
  };
  const startEdit = (id: string | null, initial?: string) => {
    if (id && board.stickies[id]?.locked) return;
    setSeed(initial);
    setEditing(id);
  };

  const onAdd = (at: Point) => {
    clearConnection();
    const id = newId();
    edit((current) => addSticky(current, { id, ...DEFAULT_STICKY_APPEARANCE, ...centeredAt(at) }));
    setPicked([id]);
    startEdit(id);
    setTool('interact');
  };

  const onMove = useCallback(
    (moves: Move[]) => edit((current) => moveStickies(current, moves)),
    [edit],
  );
  const onResize = useCallback(
    (ids: string[], size: StickySize) => edit((current) => resizeStickies(current, ids, size)),
    [edit],
  );
  const onContextMenu = useCallback(
    (id: string, point: Point) => {
      clearConnection();
      const ids = selection.has(id) ? [...selection] : [id];
      setPicked(ids);
      setMenu({ ids, point });
    },
    [selection, clearConnection],
  );
  const menuIds = menu?.ids.filter((id) => own(board.stickies, id)) ?? [];

  const onCommitText = useCallback(
    (id: string, text: string) => {
      setEditing(null);
      edit((current) => setText(current, id, text));
    },
    [edit],
  );
  const flushEditor = () => {
    const editor = boardElement.current?.querySelector<HTMLTextAreaElement>('.sticky-editor');
    if (editing && editor) onCommitText(editing, editor.value.trim());
    const label =
      boardElement.current?.parentElement?.querySelector<HTMLInputElement>(
        '.connection-label-input',
      );
    if (links.selected && label) links.onChange(links.selected.id, { label: label.value.trim() });
  };
  const save = () => {
    flushEditor();
    const current = store.load();
    downloadText(`${boardFileStem(boardTitle(current))}${FILE_EXTENSION}`, serializeBoard(current));
  };

  const onOpen = async (file: File) => {
    try {
      const opened = parseBoard(await readFileText(file));
      const title = opened.title ?? normalizeBoardTitle(file.name.replace(/\.stormlet$/i, ''));
      edit((current) => diffBoards(current, { ...opened, title }));
      setPicked([]);
      setEditing(null);
      setMenu(null);
      links.clear();
      setStatus(`${file.name}을(를) 열었습니다.`);
    } catch (error) {
      setStatus(`열 수 없는 파일입니다: ${(error as Error).message}`);
    }
  };

  useShortcuts({
    onUndo: undo,
    onRedo: redo,
    onDelete: remove,
    onTool: (tool) => {
      links.clear();
      setTool(tool);
    },
    onDuplicate: (offset, directional) =>
      links.selected ? links.duplicate() : actions.duplicate(activeIds, offset, directional),
    onSelectAll: () =>
      selectNotes(
        Object.values(board.stickies)
          .filter((s) => !s.locked)
          .map((s) => s.id),
      ),
    onGroup: actions.group,
    onLock: () =>
      links.selected
        ? links.onChange(links.selected.id, { locked: !links.selected.locked })
        : actions.lock(),
    onFormat: actions.toggleFormat,
    onNudge: (offset) =>
      onMove(selectedNotes.map((s) => ({ id: s.id, x: s.x + offset.x, y: s.y + offset.y }))),
    onSearch: () => setSearchOpen(true),
    onFit: (selected) => fit(selected ? activeIds : undefined),
    onHelp: () => setDialog('help'),
    onSave: save,
    onEscape: () => {
      setPicked([]);
      setTool('interact');
      links.clear();
    },
  });

  return (
    <div className="app">
      <Toolbar
        title={boardTitle(board)}
        onRename={(value) =>
          edit((current) => {
            const title = normalizeBoardTitle(value);
            return title === boardTitle(current) ? [] : [{ op: 'title', value: title }];
          })
        }
        canUndo={session.undo.length > 0}
        canRedo={session.redo.length > 0}
        status={status}
        onSearch={() => setSearchOpen((open) => !open)}
        onUndo={undo}
        onRedo={redo}
        onOpen={onOpen}
        onSave={save}
      />
      <main className="workspace">
        <CreationToolbar
          tool={tool}
          onTool={(tool) => {
            links.clear();
            setTool(tool);
          }}
          onAddCenter={() => onAdd(toBoardPoint(view, center()))}
          onBulk={() => setDialog('bulk')}
        />
        <div className="canvas-area">
          <BoardCanvas
            board={board}
            links={links}
            view={view}
            selection={selection}
            editing={editing}
            seed={seed}
            reactor={reactor}
            matches={query.trim() ? new Set(matches.map((s) => s.id)) : null}
            element={boardElement}
            tool={tool}
            onViewChange={setView}
            onSelect={selectNotes}
            onMove={onMove}
            onResize={onResize}
            onContextMenu={onContextMenu}
            onAdd={onAdd}
            onStartEdit={startEdit}
            onCommitText={onCommitText}
            onDuplicate={actions.duplicate}
            onReact={(id, emoji) => actions.react(emoji, [id])}
          />
          {links.selected && (
            <ConnectionToolbar
              key={links.selected.id}
              board={board}
              line={links.selected}
              view={view}
              editingLabel={links.editingLabel}
              onChange={(values) => links.onChange(links.selected!.id, values)}
              onDelete={links.remove}
            />
          )}
          {!!selectedNotes.length && !menu && (
            <SelectionToolbar
              key={activeIds.join(',')}
              notes={selectedNotes}
              view={view}
              viewport={{
                width: boardElement.current?.clientWidth ?? 900,
                height: boardElement.current?.clientHeight ?? 700,
              }}
              onFormat={(details) => {
                if (details.locked) flushEditor();
                actions.format(details);
              }}
              onColor={(color) => edit((current) => setColor(current, activeIds, color))}
              onResize={(size) => onResize(activeIds, size)}
              onArrange={actions.arrange}
              onDuplicate={() => {
                flushEditor();
                actions.duplicate();
              }}
              onGroup={() => actions.group()}
              onReact={actions.react}
              onMore={(point) => {
                flushEditor();
                const rect = boardElement.current!.getBoundingClientRect();
                setMenu({
                  ids: activeIds,
                  point: { x: point.x + rect.left, y: point.y + rect.top },
                });
              }}
            />
          )}
          {searchOpen && (
            <BoardSearch
              query={query}
              notes={matches}
              onQuery={setQuery}
              onSelect={(id) => {
                selectNotes([id]);
                fit([id]);
              }}
              onClose={() => {
                setSearchOpen(false);
                setQuery('');
              }}
            />
          )}
          <BoardChrome
            empty={
              !Object.keys(board.stickies).length && !Object.keys(board.connections ?? {}).length
            }
            tool={tool}
            zoom={view.zoom}
            onZoom={(zoom) => setView(zoomAround(view, zoom, center()))}
            onFit={() => fit()}
            onHelp={() => setDialog('help')}
          />
        </div>
      </main>
      {menu && menuIds.length > 0 && (
        <StickyContextMenu
          key={menuIds.join(',') + menu.point.x + ':' + menu.point.y}
          point={menu.point}
          count={menuIds.length}
          size={board.stickies[menuIds[0]]}
          onClose={closeMenu}
          onFront={() => edit((current) => bringToFront(current, menuIds))}
          onBack={() => edit((current) => sendToBack(current, menuIds))}
          onResize={(size) => onResize(menuIds, size)}
          onEdit={() => startEdit(menuIds[0])}
          onDelete={() => edit((current) => deleteStickies(current, menuIds))}
          locked={menuIds.some((id) => board.stickies[id].locked)}
          onDuplicate={() => actions.duplicate(menuIds)}
          onLock={() =>
            edit((current) =>
              updateNotes(current, menuIds, {
                locked: !menuIds.some((id) => current.stickies[id].locked),
              }),
            )
          }
        />
      )}
      {dialog === 'bulk' && (
        <BulkDialog
          onClose={closeDialog}
          onAdd={(texts) => actions.addCells(texts.map((text, row) => ({ text, row, column: 0 })))}
        />
      )}
      {dialog === 'help' && <HelpDialog onClose={closeDialog} />}
    </div>
  );
}
