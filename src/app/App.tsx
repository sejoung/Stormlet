import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addSticky,
  deleteStickies,
  moveStickies,
  resizeStickies,
  setText,
  type Move,
} from '../domain/commands';
import type { StickySize } from '../domain/sticky-size';
import { useBoardMenus } from './menus/useBoardMenus';
import { own } from '../domain/ids';
import { DEFAULT_STICKY_APPEARANCE } from '../domain/model';
import { boardTitle, renameBoard } from '../domain/board-title';
import type { BoardStore } from '../domain/store';
import { centeredAt } from '../engine/sticky-metrics';
import { INITIAL_VIEW, toBoardPoint, zoomAround, type Point, type View } from '../engine/viewport';
import { BoardCanvas } from '../components/board/BoardCanvas';
import type { BoardTool } from '../components/board/kinds';
import { Toolbar } from '../components/toolbar/Toolbar';
import { CreationToolbar } from '../components/toolbar/CreationToolbar';
import { useBoardFiles } from './useBoardFiles';
import { useBoardSession } from './useBoardSession';
import { useShortcuts } from './useShortcuts';
import { useNoteActions } from './useNoteActions';
import { useClipboard } from './useClipboard';
import { reactionIdentity } from '../adapters/storage/web-storage';
import { fitBoard } from '../engine/fit-view';
import { NoteSelection } from './NoteSelection';
import { useFrameSession } from './frames/useFrameSession';
import { ObjectToolbars } from './ObjectToolbars';
import { BulkDialog } from '../components/dialogs/BulkDialog';
import { HelpDialog } from '../components/dialogs/HelpDialog';
import { BoardSearch } from '../components/toolbar/BoardSearch';
import { BoardChrome } from '../components/board/BoardChrome';
import { useCreationDefaults } from './useCreationDefaults';
import { useConnectionSession } from './useConnectionSession';

export function App({ store, newId }: { store: BoardStore; newId(): string }) {
  const { session, edit, undo, redo } = useBoardSession(store);
  const { board } = session;
  const defaults = useCreationDefaults();
  const boardElement = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const [tool, setTool] = useState<BoardTool>('interact');
  const [picked, setPicked] = useState<string[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [seed, setSeed] = useState<string | undefined>();
  const [reactor] = useState(reactionIdentity);
  const [dialog, setDialog] = useState<'bulk' | 'help' | null>(null);
  const closeDialog = useCallback(() => setDialog(null), []);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const links = useConnectionSession({
    board,
    edit,
    newId,
    clearNotes: () => {
      setPicked([]);
      setSelectedFrame(null);
    },
    onTool: () => setTool('interact'),
    onStatus: setStatus,
    style: defaults.connection,
  });
  const frames = useFrameSession({
    board,
    selectedId: selectedFrame,
    edit,
    newId,
    onSelect: setSelectedFrame,
    clearObjects: () => {
      flushEditor();
      setPicked([]);
      links.clear();
      setEditing(null);
    },
    finishTool: () => setTool('interact'),
  });
  const clearConnection = links.clear;
  const selectNotes = (ids: string[]) => {
    frames.clear();
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
    stickyColor: defaults.stickyColor,
    newId,
    edit,
    onSelect: selectNotes,
    onStatus: setStatus,
    center: () => toBoardPoint(view, center()),
  });
  const remove = () =>
    frames.selected
      ? frames.remove()
      : links.selected
        ? links.remove()
        : edit((current) => deleteStickies(current, activeIds));
  const clipboard = useClipboard({
    board,
    ids: activeIds,
    frameId: frames.selectedId,
    onPaste: (source, at) =>
      Object.keys(source.frames ?? {}).length
        ? frames.paste(source, at ?? toBoardPoint(view, center()))
        : actions.pasteNotes(source, at),
    onText: actions.addCells,
    onCut: () => (frames.selected ? frames.cut() : remove()),
    onStatus: setStatus,
  });
  const fit = (ids?: string[]) =>
    setView(
      (current) =>
        fitBoard(
          board,
          boardElement.current!.getBoundingClientRect(),
          ids ? { notes: ids, connection: links.selectedId, frame: frames.selectedId } : undefined,
        ) ?? current,
    );
  const chooseTool = (next: BoardTool) => {
    flushEditor();
    links.clear();
    frames.clear();
    setTool(next);
  };
  const startEdit = (id: string | null, initial?: string) => {
    if (id && board.stickies[id]?.locked) return;
    setSeed(initial);
    setEditing(id);
  };

  const onAdd = (at: Point) => {
    frames.clear();
    clearConnection();
    const id = newId();
    edit((current) =>
      addSticky(current, {
        id,
        ...DEFAULT_STICKY_APPEARANCE,
        color: defaults.stickyColor,
        ...centeredAt(at),
      }),
    );
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
  const onCommitText = useCallback(
    (id: string, text: string) => {
      setEditing(null);
      edit((current) => setText(current, id, text));
    },
    [edit],
  );
  const flushEditor = () => {
    const frameName = boardElement.current?.querySelector<HTMLInputElement>('.frame-title-input');
    if (frames.selected && frameName)
      frames.onChange(frames.selected.id, { title: frameName.value });
    const editor = boardElement.current?.querySelector<HTMLTextAreaElement>('.sticky-editor');
    if (editing && editor) onCommitText(editing, editor.value.trim());
    const label =
      boardElement.current?.parentElement?.querySelector<HTMLInputElement>(
        '.connection-label-input',
      );
    if (links.selected && label) links.onChange(links.selected.id, { label: label.value.trim() });
  };
  const { save, onOpen } = useBoardFiles({
    store,
    edit,
    flushEditor,
    onStatus: setStatus,
    reset: () => {
      setPicked([]);
      setEditing(null);
      menus.close();
      links.clear();
      frames.clear();
    },
  });

  const menus = useBoardMenus({
    board,
    view,
    element: boardElement,
    ids: activeIds,
    frames,
    links,
    actions,
    clipboard,
    edit,
    selectNotes,
    onEdit: startEdit,
    flushEditor,
    onAdd,
    onFit: () => fit(),
    onUndo: undo,
    onRedo: redo,
    canUndo: session.undo.length > 0,
    canRedo: session.redo.length > 0,
  });

  useShortcuts({
    onUndo: undo,
    onRedo: redo,
    onDelete: remove,
    onTool: chooseTool,
    onDuplicate: (offset, directional) =>
      frames.selected
        ? frames.onDuplicate(frames.selected.id, offset?.x ?? 32, offset?.y ?? 32)
        : links.selected
          ? links.duplicate()
          : actions.duplicate(activeIds, offset, directional),
    onSelectAll: () =>
      selectNotes(
        Object.values(board.stickies)
          .filter((s) => !s.locked)
          .map((s) => s.id),
      ),
    onGroup: actions.group,
    onLock: () =>
      frames.selected
        ? frames.onChange(frames.selected.id, { locked: !frames.selected.locked })
        : links.selected
          ? links.onChange(links.selected.id, { locked: !links.selected.locked })
          : actions.lock(),
    onFormat: actions.toggleFormat,
    onNudge: (offset) =>
      frames.selected
        ? frames.onMove(frames.selected.id, offset.x, offset.y)
        : onMove(selectedNotes.map((s) => ({ id: s.id, x: s.x + offset.x, y: s.y + offset.y }))),
    onSearch: () => setSearchOpen(true),
    onFit: (selected) => fit(selected ? activeIds : undefined),
    onHelp: () => setDialog('help'),
    onSave: save,
    onEscape: () => {
      frames.clear();
      setPicked([]);
      setTool('interact');
      links.clear();
    },
  });

  return (
    <div className="app">
      <Toolbar
        title={boardTitle(board)}
        onRename={(value) => edit((current) => renameBoard(current, value))}
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
          frames={frames}
          defaults={defaults}
          onStickyColor={defaults.onStickyColor}
          onConnectionStyle={defaults.onConnection}
          tool={tool}
          onTool={chooseTool}
          onAddCenter={() => onAdd(toBoardPoint(view, center()))}
          onBulk={() => {
            setTool('interact');
            setDialog('bulk');
          }}
        />
        <div className="canvas-area">
          <BoardCanvas
            board={board}
            links={links}
            frames={frames}
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
            onContextMenu={menus.onNote}
            onCanvasMenu={menus.onCanvas}
            onAdd={onAdd}
            onStartEdit={startEdit}
            onCommitText={onCommitText}
            onDuplicate={actions.duplicate}
            onReact={(id, emoji) => actions.react(emoji, [id])}
          />
          <ObjectToolbars
            hidden={menus.open}
            board={board}
            view={view}
            frames={frames}
            links={links}
            viewport={{
              width: boardElement.current?.clientWidth ?? 900,
              height: boardElement.current?.clientHeight ?? 700,
            }}
            onDeleteFrame={frames.remove}
          />
          {!!selectedNotes.length && !menus.open && (
            <NoteSelection
              notes={selectedNotes}
              ids={activeIds}
              view={view}
              element={boardElement}
              actions={actions}
              edit={edit}
              onResize={onResize}
              flushEditor={flushEditor}
              onMenu={menus.onDetails}
              onFrame={() => {
                flushEditor();
                frames.surround(activeIds);
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
              !Object.keys(board.stickies).length &&
              !Object.keys(board.connections ?? {}).length &&
              !Object.keys(board.frames ?? {}).length
            }
            tool={tool}
            zoom={view.zoom}
            onZoom={(zoom) => setView(zoomAround(view, zoom, center()))}
            onFit={() => fit()}
            onHelp={() => setDialog('help')}
          />
        </div>
      </main>
      {menus.node}
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
