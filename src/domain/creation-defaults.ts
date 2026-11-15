import type { StickyColor } from './model';
import type { ConnectionStyle } from './connections/model';
import type { PenStyle } from './drawing/model';

/** Styles new notes and lines start with; the creation toolbar edits them. */
export interface CreationDefaults {
  stickyColor: StickyColor;
  connection: ConnectionStyle;
  pen: PenStyle;
}
