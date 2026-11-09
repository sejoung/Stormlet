import type { StickySize } from './sticky-size';
import type { NoteDetails } from './note-details';
import type { Connection } from './connections/model';
import type { Frame } from './frames/model';

/**
 * The board model (ADR 0002). Notes, connections and frames are flat maps keyed by random IDs; every
 * property is its own field and order is a number, so concurrent edits of different fields
 * or stickies never collide and the model maps one-to-one onto a CRDT map later.
 */

/** Sticky kinds of the event storming notation, from Big Picture to Design Level. */
export const STICKY_KINDS = [
  'event',
  'command',
  'actor',
  'policy',
  'aggregate',
  'readModel',
  'externalSystem',
  'hotspot',
] as const;
export type StickyKind = (typeof STICKY_KINDS)[number];

export const STICKY_COLORS = [
  'yellow',
  'orange',
  'blue',
  'green',
  'purple',
  'pink',
  'red',
  'gold',
  'lime',
  'teal',
  'sky',
  'violet',
  'rose',
  'peach',
  'gray',
  'white',
] as const;
export type StickyColor = (typeof STICKY_COLORS)[number];

/** Legacy event storming kinds retain their original colors when imported. */
export const KIND_COLORS: Record<StickyKind, StickyColor> = {
  event: 'orange',
  command: 'blue',
  actor: 'yellow',
  policy: 'purple',
  aggregate: 'gold',
  readModel: 'green',
  externalSystem: 'pink',
  hotspot: 'red',
};

export interface StickyAppearance {
  color: StickyColor;
  kind: StickyKind | null;
}
export const DEFAULT_STICKY_APPEARANCE: Readonly<StickyAppearance> = {
  color: 'yellow',
  kind: null,
};

export interface Sticky extends StickyAppearance, StickySize, NoteDetails {
  id: string;
  /** Absent for sticky notes, including all boards saved before version 10. */
  objectType?: 'text';
  text: string;
  /** Top-left corner in board coordinates. */
  x: number;
  y: number;
  /** Stacking order: higher draws on top. Ties fall back to the ID. */
  z: number;
}
export type StickyField = Exclude<keyof Sticky, 'id'>;
export const STICKY_FIELDS: readonly StickyField[] = [
  'objectType',
  'kind',
  'color',
  'text',
  'x',
  'y',
  'z',
  'width',
  'height',
  'bold',
  'italic',
  'underline',
  'textAlign',
  'textColor',
  'autoFont',
  'fontSize',
  'groupId',
  'locked',
  'reactions',
];

export interface Board {
  title?: string;
  connections?: Readonly<Record<string, Connection>>;
  frames?: Readonly<Record<string, Frame>>;
  stickies: Readonly<Record<string, Sticky>>;
}

export const emptyBoard = (): Board => ({ stickies: {} });

/** Whether the board has no notes, connections or frames. */
export const isEmptyBoard = (board: Board): boolean =>
  !Object.keys(board.stickies).length &&
  !Object.keys(board.connections ?? {}).length &&
  !Object.keys(board.frames ?? {}).length;

export const isStickyKind = (value: unknown): value is StickyKind =>
  typeof value === 'string' && (STICKY_KINDS as readonly string[]).includes(value);

export const isStickyColor = (value: unknown): value is StickyColor =>
  typeof value === 'string' && (STICKY_COLORS as readonly string[]).includes(value);

/** Bottom-to-top comparator: higher `z` draws on top, ties fall back to the ID. */
export const byStackOrder = (a: Sticky, b: Sticky): number => a.z - b.z || (a.id < b.id ? -1 : 1);

/** Stickies from bottom to top. */
export const stackOrder = (board: Board): Sticky[] =>
  Object.values(board.stickies).sort(byStackOrder);

export const topZ = (board: Board): number =>
  Object.values(board.stickies).reduce((max, sticky) => Math.max(max, sticky.z), 0);
