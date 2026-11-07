import type { Board, Sticky } from '../model';
import { own } from '../ids';
import { DEFAULT_FRAME_TITLE, type Frame } from '../frames/model';
import { frameOf, matchEndpoint, stickyOf, type Endpoint } from './model';

/** Label of an attached note without text; shown wherever a connection names its ends. */
export const EMPTY_NOTE_LABEL = '빈 메모';

export const endpointObject = (board: Board, end: Endpoint): Sticky | Frame | undefined =>
  matchEndpoint<Sticky | Frame | undefined>(end, {
    sticky: (id) => own(board.stickies, id),
    frame: (id) => own(board.frames ?? {}, id),
    free: () => undefined,
  });

export const sameAttachment = (a: Endpoint, b: Endpoint): boolean =>
  (stickyOf(a) !== undefined && stickyOf(a) === stickyOf(b)) ||
  (frameOf(a) !== undefined && frameOf(a) === frameOf(b));

export const endpointLabel = (board: Board, end: Endpoint, fallback: string): string =>
  matchEndpoint(end, {
    sticky: (id) => own(board.stickies, id)?.text || EMPTY_NOTE_LABEL,
    frame: (id) => own(board.frames ?? {}, id)?.title || DEFAULT_FRAME_TITLE,
    free: () => fallback,
  });
