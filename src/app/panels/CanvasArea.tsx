import type { Board } from '../../domain/model';
import { BoardCanvas } from '../../components/board/BoardCanvas';
import type { BoardTool } from '../../components/board/kinds';
import type { Edit } from '../useBoardSession';
import type { NoteActions } from '../useNoteActions';
import type { ConnectionSession } from '../useConnectionSession';
import type { FrameSession } from '../frames/useFrameSession';
import type { usePenSession } from '../drawing/usePenSession';
import type { useBoardMenus } from '../menus/useBoardMenus';
import type { useSelection } from '../selection/useSelection';
import { NoteSelection } from '../selection/NoteSelection';
import { ObjectToolbars } from '../selection/ObjectToolbars';
import type { NoteEditing } from '../notes/useNoteEditing';
import type { BoardView } from '../view/useBoardView';
import type { useMinimap } from '../view/useMinimap';
import type { Grid } from '../view/useGrid';
import type { SearchState } from './useBoardSearch';
import { CanvasPanels } from './CanvasPanels';

/**
 * The canvas and what floats over it: the board, the toolbars of a selected frame, line or
 * notes, and the search, minimap and zoom panels. The sessions come from the Workspace.
 */
export function CanvasArea({
  board,
  tool,
  canvas,
  notes,
  links,
  frames,
  pen,
  actions,
  menus,
  selected,
  search,
  minimap,
  grid,
  reactor,
  edit,
  flushEditor,
  onFit,
  onHelp,
}: {
  board: Board;
  tool: BoardTool;
  canvas: BoardView;
  notes: NoteEditing;
  links: ConnectionSession;
  frames: FrameSession;
  pen: ReturnType<typeof usePenSession>;
  actions: NoteActions;
  menus: ReturnType<typeof useBoardMenus>;
  selected: ReturnType<typeof useSelection>;
  search: SearchState;
  minimap: ReturnType<typeof useMinimap>;
  grid: Grid;
  reactor: string;
  edit: Edit;
  flushEditor(): void;
  /** Fit the whole board, or the given notes with the selected frame or line. */
  onFit(ids?: readonly string[]): void;
  onHelp(): void;
}) {
  const { view, viewport } = canvas;
  const { activeIds } = notes;
  return (
    <div className="canvas-area">
      <BoardCanvas
        board={board}
        links={links}
        frames={frames}
        view={view}
        pen={pen}
        viewport={viewport}
        selection={notes.selection}
        editing={notes.editing}
        seed={notes.seed}
        reactor={reactor}
        matches={search.matches}
        element={canvas.element}
        tool={tool}
        grid={grid}
        onViewChange={canvas.setView}
        onSelect={selected.selectNotes}
        onMove={notes.move}
        onResize={notes.place}
        onContextMenu={menus.onNote}
        onCanvasMenu={menus.onCanvas}
        onAdd={notes.add}
        onAddText={notes.addText}
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
      <CanvasPanels
        board={board}
        canvas={canvas}
        search={search}
        minimap={minimap}
        tool={tool}
        onFound={(id) => {
          selected.selectNotes([id]);
          onFit([id]);
        }}
        onFit={() => onFit()}
        onHelp={onHelp}
      />
    </div>
  );
}
