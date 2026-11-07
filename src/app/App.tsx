import { useCallback, useMemo, useRef, useState } from 'react';
import {
  addSticky,
  deleteStickies,
  editableIds,
  moveStickies,
  resizeStickies,
  setText,
  type Move,
} from '../domain/commands';
import type { StickySize } from '../domain/sticky-size';
import { own } from '../domain/ids';
import { DEFAULT_STICKY_APPEARANCE, isEmptyBoard } from '../domain/model';
import { boardTitle, renameBoard } from '../domain/board-title';
import type { BoardStore } from '../domain/store';
import { centeredAt } from '../engine/sticky-metrics';
import { INITIAL_VIEW, toBoardPoint, zoomAround, type Point, type View } from '../engine/viewport';
import { fitBoard } from '../engine/fit-view';
import { reactionIdentity } from '../adapters/storage/web-storage';
import { BoardCanvas } from '../components/board/BoardCanvas';
import type { BoardTool } from '../components/board/kinds';
import { Toolbar } from '../components/toolbar/Toolbar';
import { CreationToolbar } from '../components/toolbar/CreationToolbar';
import { BulkDialog } from '../components/dialogs/BulkDialog';
import { HelpDialog } from '../components/dialogs/HelpDialog';
import { BoardSearch } from '../components/toolbar/BoardSearch';
import { BoardChrome } from '../components/board/BoardChrome';
import { DraftProvider, useDraftRegistry } from '../components/common/drafts';
import { useElementSize } from '../components/common/useElementSize';
import { elementCenter } from '../components/common/points';
import { useBoardFiles } from './useBoardFiles';
import { useBoardSession } from './useBoardSession';
import { useShortcuts } from './useShortcuts';
import { useNoteActions } from './useNoteActions';
import { useClipboard } from './useClipboard';
import { useCreationDefaults } from './useCreationDefaults';
import { useConnectionSession } from './useConnectionSession';
import { useFrameSession } from './frames/useFrameSession';
import { useBoardMenus } from './menus/useBoardMenus';
import { BoardMenus } from './menus/BoardMenus';
import { useSelection } from './selection/useSelection';
import { selectionCommands } from './selection/selection-commands';
import { NoteSelection } from './NoteSelection';
import { ObjectToolbars } from './ObjectToolbars';
import { useBoardSearch } from './panels/useBoardSearch';
import { useStatus } from './panels/useStatus';

export function App({ store, newId }: { store: BoardStore; newId(): string }) {
  // --- Board, history and view ---
  const { session, edit, editWith, undo, redo } = useBoardSession(store);
  const { board } = session;
  const defaults = useCreationDefaults();
  const boardElement = useRef<HTMLDivElement>(null);
  const viewport = useElementSize(boardElement);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const [tool, setTool] = useState<BoardTool>('interact');
  const [reactor] = useState(reactionIdentity);

  // --- Selection and text editing ---
  const selected = useSelection();
  const drafts = useDraftRegistry();
  const flushEditor = drafts.flushAll;
  const [editing, setEditing] = useState<string | null>(null);
  const [seed, setSeed] = useState<string | undefined>();
  const selection = useMemo(
    () => new Set(selected.noteIds.filter((id) => own(board.stickies, id))),
    [selected.noteIds, board.stickies],
  );
  const activeIds = useMemo(
    () => (editing && own(board.stickies, editing) ? [editing] : [...selection]),
    [editing, board.stickies, selection],
  );
  const selectedNotes = activeIds.map((id) => board.stickies[id]);

  // --- Panels and messages ---
  const [dialog, setDialog] = useState<'bulk' | 'help' | null>(null);
  const closeDialog = useCallback(() => setDialog(null), []);
  const search = useBoardSearch(board);
  const [status, setStatus] = useStatus();

  // --- Helpers shared by the commands below ---
  const viewportCenter = () => elementCenter(boardElement.current!);
  const boardCenter = () => toBoardPoint(view, viewportCenter());
  const finishTool = () => setTool('interact');
  const selectFrame = (id: string) => {
    flushEditor();
    setEditing(null);
    selected.selectFrame(id);
  };
  const startEdit = (id: string | null, initial?: string) => {
    if (id && own(board.stickies, id)?.locked) return;
    setSeed(initial);
    setEditing(id);
  };
  const chooseTool = (next: BoardTool) => {
    flushEditor();
    selected.clearObjects();
    setTool(next);
  };
  const fit = (ids?: readonly string[]) =>
    setView(
      (current) =>
        fitBoard(
          board,
          boardElement.current!.getBoundingClientRect(),
          ids
            ? { notes: ids, connection: selected.connectionId, frame: selected.frameId }
            : undefined,
        ) ?? current,
    );

  // --- Note editing ---
  const onAdd = (at: Point) => {
    const id = newId();
    edit((current) =>
      addSticky(current, {
        id,
        ...DEFAULT_STICKY_APPEARANCE,
        color: defaults.stickyColor,
        ...centeredAt(at),
      }),
    );
    selected.selectNotes([id]);
    startEdit(id);
    finishTool();
  };
  const onMove = (moves: Move[]) => edit((current) => moveStickies(current, moves));
  const onResize = (ids: readonly string[], size: StickySize) =>
    edit((current) => resizeStickies(current, ids, size));
  const onCommitText = (id: string, text: string) => {
    setEditing(null);
    edit((current) => setText(current, id, text));
  };

  // --- Object sessions ---
  const links = useConnectionSession({
    board,
    edit,
    editWith,
    newId,
    selectedId: selected.connectionId,
    editingLabel: selected.editingLabel,
    onSelect: selected.selectConnection,
    onLabelDone: selected.finishLabel,
    onCreated: finishTool,
    onStatus: setStatus,
    style: defaults.connection,
  });
  const frames = useFrameSession({
    board,
    selectedId: selected.frameId,
    edit,
    editWith,
    newId,
    onSelect: selectFrame,
    onCreated: finishTool,
  });
  const actions = useNoteActions({
    board,
    ids: activeIds,
    reactor,
    stickyColor: defaults.stickyColor,
    newId,
    edit,
    editWith,
    onSelect: selected.selectNotes,
    onStatus: setStatus,
    center: boardCenter,
  });
  const commands = selectionCommands(frames, links, {
    remove: () => edit((current) => deleteStickies(current, activeIds)),
    cut: () => edit((current) => deleteStickies(current, activeIds)),
    duplicate: (offset, directional) => actions.duplicate(activeIds, offset, directional),
    toggleLock: actions.lock,
    nudge: (offset) =>
      onMove(selectedNotes.map((s) => ({ id: s.id, x: s.x + offset.x, y: s.y + offset.y }))),
  });
  const selectAll = () => selected.selectNotes(editableIds(board, Object.keys(board.stickies)));

  // --- Clipboard, files, menus and keys ---
  const clipboard = useClipboard({
    board,
    ids: activeIds,
    frameId: frames.selectedId,
    onPaste: (source, at) =>
      Object.keys(source.frames ?? {}).length
        ? frames.paste(source, at ?? boardCenter())
        : actions.pasteNotes(source, at),
    onText: actions.addCells,
    onCut: commands.cut,
    onStatus: setStatus,
  });
  const menus = useBoardMenus({
    ids: activeIds,
    flushEditor,
    selectNotes: selected.selectNotes,
    selectFrame,
    selectConnection: selected.selectConnection,
  });
  const { save, onOpen } = useBoardFiles({
    store,
    edit,
    flushEditor,
    onStatus: setStatus,
    reset: () => {
      selected.clear();
      setEditing(null);
      menus.close();
    },
  });
  useShortcuts({
    onUndo: undo,
    onRedo: redo,
    onDelete: commands.remove,
    onTool: chooseTool,
    onDuplicate: commands.duplicate,
    onSelectAll: selectAll,
    onGroup: actions.group,
    onLock: commands.toggleLock,
    onFormat: actions.toggleFormat,
    onNudge: commands.nudge,
    onSearch: search.show,
    onFit: (onlySelected) => fit(onlySelected ? activeIds : undefined),
    onHelp: () => setDialog('help'),
    onSave: save,
    onEscape: () => {
      selected.clear();
      finishTool();
    },
  });

  const canUndo = session.undo.length > 0;
  const canRedo = session.redo.length > 0;
  return (
    <DraftProvider registry={drafts}>
      <div className="app">
        <Toolbar
          title={boardTitle(board)}
          onRename={(value) => edit((current) => renameBoard(current, value))}
          canUndo={canUndo}
          canRedo={canRedo}
          status={status}
          onSearch={search.toggle}
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
            onAddCenter={() => onAdd(boardCenter())}
            onBulk={() => {
              finishTool();
              setDialog('bulk');
            }}
          />
          <div className="canvas-area">
            <BoardCanvas
              board={board}
              links={links}
              frames={frames}
              view={view}
              viewport={viewport}
              selection={selection}
              editing={editing}
              seed={seed}
              reactor={reactor}
              matches={search.matches}
              element={boardElement}
              tool={tool}
              onViewChange={setView}
              onSelect={selected.selectNotes}
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
              viewport={viewport}
              onDeleteFrame={frames.remove}
            />
            {!!selectedNotes.length && !menus.open && (
              <NoteSelection
                notes={selectedNotes}
                ids={activeIds}
                view={view}
                viewport={viewport}
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
            {search.open && (
              <BoardSearch
                query={search.query}
                notes={search.notes}
                onQuery={search.setQuery}
                onSelect={(id) => {
                  selected.selectNotes([id]);
                  fit([id]);
                }}
                onClose={search.close}
              />
            )}
            <BoardChrome
              empty={isEmptyBoard(board)}
              tool={tool}
              zoom={view.zoom}
              onZoom={(zoom) => setView(zoomAround(view, zoom, viewportCenter()))}
              onFit={() => fit()}
              onHelp={() => setDialog('help')}
            />
          </div>
        </main>
        <BoardMenus
          menu={menus.menu}
          board={board}
          view={view}
          element={boardElement}
          edit={edit}
          ids={activeIds}
          frames={frames}
          links={links}
          clipboard={clipboard}
          onClose={menus.close}
          onEdit={startEdit}
          onDuplicate={actions.duplicate}
          onAdd={onAdd}
          onSelectAll={selectAll}
          onFit={() => fit()}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
        />
        {dialog === 'bulk' && (
          <BulkDialog
            onClose={closeDialog}
            onAdd={(texts) =>
              actions.addCells(texts.map((text, row) => ({ text, row, column: 0 })))
            }
          />
        )}
        {dialog === 'help' && <HelpDialog onClose={closeDialog} />}
      </div>
    </DraftProvider>
  );
}
