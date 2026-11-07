import type { StickyColor } from './model';
import type { ConnectionStyle } from './connections/model';

/** Styles new notes and lines start with; the creation toolbar edits them. */
export interface CreationDefaults {
  stickyColor: StickyColor;
  connection: ConnectionStyle;
}
