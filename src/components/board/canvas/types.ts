import type { RefObject } from 'react';
import type { Board, StickyColor } from '../../../domain/model';
import type { Move, Placement } from '../../../domain/commands';
import type { StickySize } from '../../../domain/sticky-size';
import type { NextNote } from '../../../domain/note-actions';
import type { Point, View } from '../../../engine/viewport';
import type { BoardTool } from '../kinds';
import type { ConnectionInteraction } from '../../connections/types';
import type { FrameInteraction } from '../../frames/types';
import type { CanvasTarget } from '../../menus/CanvasContextMenu';
import type { Size } from '../../common/useElementSize';
import type { PenInteraction } from '../../drawing/usePenDrawing';

export interface CanvasProps {
  board: Board;
  links: ConnectionInteraction;
  frames: FrameInteraction;
  pen: PenInteraction;
  view: View;
  viewport: Size;
  selection: ReadonlySet<string>;
  editing: string | null;
  seed?: string;
  reactor: string;
  matches: ReadonlySet<string> | null;
  element: RefObject<HTMLDivElement | null>;
  tool: BoardTool;
  onViewChange(view: View): void;
  onSelect(ids: string[]): void;
  onMove(moves: Move[]): void;
  /** Commit a resize: new positions and sizes for the notes. */
  onResize(placements: readonly Placement[]): void;
  /** Whether the grid is drawn, and whether moves and resizes snap to it. */
  grid: { visible: boolean; snap: boolean };
  onContextMenu(id: string, point: Point): void;
  onCanvasMenu(point: Point, target: CanvasTarget): void;
  onAdd(at: Point, color?: StickyColor): void;
  onAddText(at: Point): void;
  onStartEdit(id: string | null, seed?: string): void;
  onCommitText(id: string, text: string, next?: NextNote, size?: StickySize): void;
  onDuplicate(ids: string[], offset: Point): void;
  onReact(id: string, emoji: string): void;
}
