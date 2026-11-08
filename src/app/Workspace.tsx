import { useRef, useState } from 'react';
import { useLocale } from '../components/common/i18n';
import { deleteStickies, editableIds } from '../domain/commands';
import { isEmptyBoard } from '../domain/model';
import { boardTitle, renameBoard } from '../domain/board-title';
import type { BoardStore } from '../domain/store';
import type { LocalePreference } from '../i18n/messages';
import { reactionIdentity } from '../adapters/storage/web-storage';
import { BoardCanvas } from '../components/board/BoardCanvas';
import type { BoardTool } from '../components/board/kinds';
import { Toolbar } from '../components/toolbar/Toolbar';
import { CreationToolbar } from '../components/toolbar/CreationToolbar';
import { BoardSearch } from '../components/toolbar/BoardSearch';
import { BoardChrome } from '../components/board/BoardChrome';
import { DraftProvider, useDraftRegistry } from '../components/common/drafts';
import { FitProvider, useFitRegistry } from '../components/common/fitted-fonts';
import { useBoardFiles } from './useBoardFiles';
import { useBoardSession } from './useBoardSession';
import { useShortcuts, type ShortcutHandlers } from './useShortcuts';
import { useNoteActions } from './useNoteActions';
import { useClipboard } from './useClipboard';
import { useCreationDefaults } from './useCreationDefaults';
import { useConnectionSession } from './useConnectionSession';
import { useFrameSession } from './frames/useFrameSession';
import { useBoardMenus } from './menus/useBoardMenus';
import { BoardMenus } from './menus/BoardMenus';
import { useSelection } from './selection/useSelection';
import { selectionCommands } from './selection/selection-commands';
import { NoteSelection } from './selection/NoteSelection';
import { ObjectToolbars } from './selection/ObjectToolbars';
import { useBoardSearch } from './panels/useBoardSearch';
import { useStatus } from './panels/useStatus';
import { useBoardView } from './view/useBoardView';
import { useNoteEditing } from './notes/useNoteEditing';
import { useMinimap } from './view/useMinimap';
import { Minimap } from '../components/minimap/Minimap';
import { diagnostics } from './diagnostics/diagnostics';
import { useSaveHealth } from './diagnostics/useSaveHealth';
import { useDrive, type DriveServices } from './drive/useDrive';
import { WorkspaceDialogs, type DialogName } from './panels/WorkspaceDialogs';
import { AppSettings, SyncStatus, ToolbarMenus } from './panels/ToolbarMenus';

export interface WorkspaceProps {
  store: BoardStore;
  newId(): string;
  /** Google Drive, when this build is configured for it. */
  drive?: DriveServices;
  language: LocalePreference;
  onLanguage(language: LocalePreference): void;
}

/** The editor: toolbars, canvas, panels and dialogs around one board session. */
export function Workspace({
  store,
  newId,
  drive: driveServices,
  language,
  onLanguage,
}: WorkspaceProps) {
  // --- Board, history and view ---
  const { session, edit, editWith, undo, redo } = useBoardSession(store);
  const { board } = session;
  const saved = useSaveHealth(store);
  const locale = useLocale();
  const defaults = useCreationDefaults();
  const canvas = useBoardView();
  const { view, viewport } = canvas;
  const minimap = useMinimap();
  const [tool, setTool] = useState<BoardTool>('interact');
  const finishTool = () => setTool('interact');
  const [reactor] = useState(reactionIdentity);

  // --- Selection and text editing ---
  const selected = useSelection();
  const drafts = useDraftRegistry();
  const fits = useFitRegistry();
  const flushEditor = drafts.flushAll;
  const notes = useNoteEditing({
    board,
    edit,
    newId,
    stickyColor: defaults.stickyColor,
    selectedIds: selected.noteIds,
    onSelect: selected.selectNotes,
    onAdded: finishTool,
  });
  const { activeIds } = notes;

  // --- Panels and messages ---
  const [dialog, setDialog] = useState<DialogName | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const search = useBoardSearch(board);
  const [status, setStatus] = useStatus();

  // --- Helpers shared by the commands below ---
  const selectFrame = (id: string) => {
    flushEditor();
    notes.stopEdit();
    selected.selectFrame(id);
  };
  const chooseTool = (next: BoardTool) => {
    flushEditor();
    selected.clearObjects();
    setTool(next);
  };
  /** Fit the whole board, or the given notes with the selected frame or line. */
  const fit = (ids?: readonly string[]) =>
    canvas.fit(
      board,
      ids && { notes: ids, connection: selected.connectionId, frame: selected.frameId },
    );

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
    center: canvas.boardCenter,
  });
  const commands = selectionCommands(frames, links, {
    remove: () => edit((current) => deleteStickies(current, activeIds)),
    cut: () => edit((current) => deleteStickies(current, activeIds)),
    duplicate: (offset, directional) => actions.duplicate(activeIds, offset, directional),
    toggleLock: actions.lock,
    nudge: (offset) =>
      notes.move(
        notes.activeNotes.map((s) => ({ id: s.id, x: s.x + offset.x, y: s.y + offset.y })),
      ),
  });
  const selectAll = () => selected.selectNotes(editableIds(board, Object.keys(board.stickies)));

  // --- Clipboard, files, menus and keys ---
  const clipboard = useClipboard({
    board,
    ids: activeIds,
    frameId: frames.selectedId,
    onPaste: (source, at) =>
      Object.keys(source.frames ?? {}).length
        ? frames.paste(source, at ?? canvas.boardCenter())
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
  const { save, onOpen, replace, newBoard } = useBoardFiles({
    store,
    edit,
    flushEditor,
    onStatus: setStatus,
    // A local file is a different board, so the Drive file stops following this one.
    beforeOpen: () => driveServices?.sync.unlink(),
    reset: () => {
      selected.clear();
      notes.stopEdit();
      menus.close();
    },
  });
  const drive = useDrive({
    services: driveServices,
    flushEditor,
    replaceBoard: replace,
    onStatus: setStatus,
  });
  // The same commands back the shortcuts and the Edit and View menus.
  const keys: ShortcutHandlers = {
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
    onOpenFile: () => fileInput.current?.click(),
    onEscape: () => {
      selected.clear();
      finishTool();
    },
  };
  useShortcuts(keys);

  const canUndo = session.undo.length > 0;
  const canRedo = session.redo.length > 0;
  return (
    <DraftProvider registry={drafts}>
      <FitProvider registry={fits}>
        <div className="app">
          <Toolbar
            title={boardTitle(board)}
            saved={saved}
            onRename={(value) => edit((current) => renameBoard(current, value))}
            canUndo={canUndo}
            canRedo={canRedo}
            status={status}
            onSearch={search.toggle}
            onUndo={undo}
            onRedo={redo}
            onSave={save}
            menus={
              <ToolbarMenus
                fileInput={fileInput}
                onNew={() => setDialog('new')}
                onOpenFile={onOpen}
                onDownload={save}
                keys={keys}
                clipboard={clipboard}
                canvas={canvas}
                minimap={minimap}
                history={{ canUndo, canRedo }}
                selection={{ ids: activeIds, object: selected.frameId ?? selected.connectionId }}
                drive={drive}
              />
            }
            settings={
              <AppSettings language={language} onLanguage={onLanguage} onDialog={setDialog} />
            }
            sync={
              'file' in drive.state ? <SyncStatus drive={drive} onDialog={setDialog} /> : undefined
            }
          />
          <main className="workspace">
            <CreationToolbar
              frames={frames}
              defaults={defaults}
              onStickyColor={defaults.onStickyColor}
              onConnectionStyle={defaults.onConnection}
              tool={tool}
              onTool={chooseTool}
              onAddCenter={() => notes.add(canvas.boardCenter())}
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
                selection={notes.selection}
                editing={notes.editing}
                seed={notes.seed}
                reactor={reactor}
                matches={search.matches}
                element={canvas.element}
                tool={tool}
                onViewChange={canvas.setView}
                onSelect={selected.selectNotes}
                onMove={notes.move}
                onResize={notes.resize}
                onContextMenu={menus.onNote}
                onCanvasMenu={menus.onCanvas}
                onAdd={notes.add}
                onStartEdit={notes.startEdit}
                onCommitText={notes.commitText}
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
              {!!activeIds.length && !menus.open && (
                <NoteSelection
                  notes={notes.activeNotes}
                  ids={activeIds}
                  view={view}
                  viewport={viewport}
                  element={canvas.element}
                  actions={actions}
                  edit={edit}
                  onResize={notes.resize}
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
              {minimap.open && (
                <Minimap
                  board={board}
                  view={view}
                  viewport={viewport}
                  onViewChange={canvas.setView}
                />
              )}
              <BoardChrome
                empty={isEmptyBoard(board)}
                tool={tool}
                zoom={view.zoom}
                minimap={minimap.open}
                onZoom={canvas.zoomTo}
                onFit={() => fit()}
                onMinimap={minimap.toggle}
                onHelp={() => setDialog('help')}
              />
            </div>
          </main>
          <BoardMenus
            menu={menus.menu}
            board={board}
            view={view}
            element={canvas.element}
            edit={edit}
            ids={activeIds}
            frames={frames}
            links={links}
            clipboard={clipboard}
            onClose={menus.close}
            onEdit={notes.startEdit}
            onDuplicate={actions.duplicate}
            onAdd={notes.add}
            onSelectAll={selectAll}
            onFit={() => fit()}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
          <WorkspaceDialogs
            dialog={dialog}
            onDialog={setDialog}
            board={board}
            onNewBoard={newBoard}
            onDownload={save}
            onBulkAdd={(texts) =>
              actions.addCells(texts.map((text, row) => ({ text, row, column: 0 })))
            }
            diagnostics={diagnostics(locale, () => store.load())}
            drive={drive}
          />
        </div>
      </FitProvider>
    </DraftProvider>
  );
}
