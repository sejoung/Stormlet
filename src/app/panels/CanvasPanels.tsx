import type { Board } from '../../domain/model';
import { isEmptyBoard } from '../../domain/model';
import type { BoardTool } from '../../components/board/kinds';
import { BoardSearch } from '../../components/toolbar/BoardSearch';
import { BoardChrome } from '../../components/board/BoardChrome';
import { Minimap } from '../../components/minimap/Minimap';
import type { BoardView } from '../view/useBoardView';
import type { SearchState } from './useBoardSearch';

/** What floats over the canvas: the search panel, the minimap and the zoom controls. */
export function CanvasPanels({
  board,
  canvas,
  search,
  minimap,
  tool,
  onFound,
  onFit,
  onHelp,
}: {
  board: Board;
  canvas: BoardView;
  search: SearchState;
  minimap: { open: boolean; toggle(): void };
  tool: BoardTool;
  /** A search result was picked: select the note and bring it into view. */
  onFound(id: string): void;
  onFit(): void;
  onHelp(): void;
}) {
  return (
    <>
      {search.open && (
        <BoardSearch
          query={search.query}
          notes={search.notes}
          onQuery={search.setQuery}
          onSelect={onFound}
          onClose={search.close}
        />
      )}
      {minimap.open && (
        <Minimap
          board={board}
          view={canvas.view}
          viewport={canvas.viewport}
          onViewChange={canvas.setView}
        />
      )}
      <BoardChrome
        empty={isEmptyBoard(board)}
        tool={tool}
        zoom={canvas.view.zoom}
        minimap={minimap.open}
        onZoom={canvas.zoomTo}
        onFit={onFit}
        onMinimap={minimap.toggle}
        onHelp={onHelp}
      />
    </>
  );
}
