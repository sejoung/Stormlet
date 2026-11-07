import type { Board } from '../model';
import { own } from '../ids';
import type { Endpoint } from './model';

export const endpointObject = (board: Board, end: Endpoint) =>
  'stickyId' in end
    ? own(board.stickies, end.stickyId)
    : 'frameId' in end
      ? own(board.frames ?? {}, end.frameId)
      : undefined;

export const sameAttachment = (a: Endpoint, b: Endpoint): boolean =>
  ('stickyId' in a && 'stickyId' in b && a.stickyId === b.stickyId) ||
  ('frameId' in a && 'frameId' in b && a.frameId === b.frameId);

export function endpointLabel(board: Board, end: Endpoint, fallback: string): string {
  if ('stickyId' in end) return own(board.stickies, end.stickyId)?.text || '빈 메모';
  if ('frameId' in end) return own(board.frames ?? {}, end.frameId)?.title || '프레임';
  return fallback;
}
