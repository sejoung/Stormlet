import type { Frame, FrameBounds, FrameSize } from '../../domain/frames/model';

export interface FrameInteraction {
  selectedId: string | null;
  selected: Frame | null;
  size: FrameSize;
  onPreset(size: FrameSize): void;
  onSelect(id: string): void;
  onCreate(bounds: FrameBounds): void;
  onChange(id: string, values: Partial<Omit<Frame, 'id'>>): void;
  onMove(id: string, dx: number, dy: number): void;
  onDuplicate(id: string, dx?: number, dy?: number): void;
}
