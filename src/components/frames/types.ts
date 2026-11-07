import type { Frame, FrameBounds } from '../../domain/frames/model';
import type { StickySize } from '../../domain/sticky-size';

export interface FrameInteraction {
  selectedId: string | null;
  selected: Frame | null;
  size: StickySize;
  onPreset(size: StickySize): void;
  onSelect(id: string): void;
  onCreate(bounds: FrameBounds): void;
  onChange(id: string, values: Partial<Omit<Frame, 'id'>>): void;
  onMove(id: string, dx: number, dy: number): void;
  onDuplicate(id: string, dx?: number, dy?: number): void;
}
