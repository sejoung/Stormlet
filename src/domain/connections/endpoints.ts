import type { Board, Sticky } from '../model';
import { own } from '../ids';
import { DEFAULT_FRAME_TITLE, type Frame } from '../frames/model';
import { frameOf, isFreeEndpoint, matchEndpoint, stickyOf, type Endpoint } from './model';

/** Words, in the current language, for connection ends that have no text of their own. */
export interface EndpointNames {
  /** A free end not attached to anything. */
  free: string;
  /** An attached note without text. */
  emptyNote: string;
}

export const endpointObject = (board: Board, end: Endpoint): Sticky | Frame | undefined =>
  matchEndpoint<Sticky | Frame | undefined>(end, {
    sticky: (id) => own(board.stickies, id),
    frame: (id) => own(board.frames ?? {}, id),
    free: () => undefined,
  });

export const sameAttachment = (a: Endpoint, b: Endpoint): boolean =>
  (stickyOf(a) !== undefined && stickyOf(a) === stickyOf(b)) ||
  (frameOf(a) !== undefined && frameOf(a) === frameOf(b));

export const endpointExists = (board: Board, endpoint: Endpoint): boolean =>
  isFreeEndpoint(endpoint)
    ? Number.isFinite(endpoint.x) && Number.isFinite(endpoint.y)
    : !!endpointObject(board, endpoint);

/** Both ends exist and are not the same object; a line that fails this cannot be drawn. */
export function validEndpoints(board: Board, from: Endpoint, to: Endpoint): boolean {
  return endpointExists(board, from) && endpointExists(board, to) && !sameAttachment(from, to);
}

export const endpointLabel = (board: Board, end: Endpoint, names: EndpointNames): string =>
  matchEndpoint(end, {
    sticky: (id) => own(board.stickies, id)?.text || names.emptyNote,
    frame: (id) => own(board.frames ?? {}, id)?.title || DEFAULT_FRAME_TITLE,
    free: () => names.free,
  });
