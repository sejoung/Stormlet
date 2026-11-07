import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import type { Board } from '../../domain/model';
import { DEFAULT_CONNECTION, type Endpoint, type Connection } from '../../domain/connections/model';
import { endpointAnchor } from '../../engine/connections/geometry';
import { constrainEndpoint, snapEndpoint } from '../../engine/connections/snapping';
import type { Point, View } from '../../engine/viewport';
import { own } from '../../domain/ids';
import type { ConnectionInteraction } from './types';
import { clientToBoard } from '../common/points';
import { TEXT_ENTRY } from '../common/keyboard';

type End = 'from' | 'to';

/** What the canvas needs from a connection being drawn or rewired. */
export interface ConnectionDrawing {
  /** The line as it would be created now, for preview; `null` when not drawing. */
  draft: Connection | null;
  active: boolean;
  cancel(): void;
  /** Start (or, for a click-click line, finish) at a background, note or frame press. */
  backgroundDown(event: PointerEvent, source?: Endpoint): boolean;
  begin(event: PointerEvent, source?: Endpoint, existing?: { id: string; end: End }): boolean;
  move(event: PointerEvent): boolean;
  up(event: PointerEvent): boolean;
  keyboardStart(endpoint: Endpoint): void;
  keyboardReconnect(id: string, end: End): void;
  confirm(endpoint: Endpoint): void;
}

interface Draft {
  from: Endpoint;
  to: Endpoint;
  pointer: Point;
  pressed: boolean;
  moved: boolean;
  existing?: { id: string; end: End };
}
/** Pointer travel (screen px) after which a press becomes a drag instead of a click. */
const DRAG_START = 4;
/** Tool shortcut keys; pressing one abandons a line in progress. */
const TOOL_KEYS = ['v', 'h', 'n', 'l'];
interface Options {
  board: Board;
  view: View;
  element: RefObject<HTMLDivElement | null>;
  tool: string;
  links: ConnectionInteraction;
}

export function useConnectionDrawing({
  board,
  view,
  element,
  tool,
  links,
}: Options): ConnectionDrawing {
  const current = useRef<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const put = (next: Draft | null) => {
    current.current = next;
    setDraft(next);
  };
  const cancel = useCallback(() => {
    current.current = null;
    setDraft(null);
  }, []);
  useEffect(() => {
    cancel();
  }, [tool, cancel]);
  useEffect(() => {
    const outside = (event: globalThis.PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest('.toolbar, .tool-panel, .selection-toolbar, .connection-toolbar')
      )
        cancel();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (
        !event.defaultPrevented &&
        TOOL_KEYS.includes(event.key.toLowerCase()) &&
        !(event.target instanceof Element && event.target.closest(TEXT_ENTRY))
      )
        cancel();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('contextmenu', cancel, true);
    window.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('contextmenu', cancel, true);
      window.removeEventListener('keydown', keyboard);
    };
  }, [cancel]);
  const point = (event: { clientX: number; clientY: number }) =>
    clientToBoard(element.current!, view, event);
  const target = (event: PointerEvent, state?: Draft): Endpoint => {
    let at = point(event);
    const fixed = state && (state.existing?.end === 'from' ? state.to : state.from);
    const origin = fixed && endpointAnchor(board, fixed, at);
    if (event.shiftKey && origin) at = constrainEndpoint(origin, at);
    return snapEndpoint(board, at, view.zoom, event.ctrlKey || event.metaKey);
  };
  const finish = (state: Draft, end: Endpoint) => {
    const from = state.existing?.end === 'from' ? end : state.from;
    const to = state.existing?.end === 'from' ? state.to : end;
    if (state.existing) links.onChange(state.existing.id, { from, to });
    else links.onCreate(from, to);
    put(null);
  };
  const begin = (event: PointerEvent, source?: Endpoint, existing?: Draft['existing']) => {
    if (event.button !== 0) return false;
    event.preventDefault();
    event.stopPropagation();
    element.current!.focus();
    const state = current.current;
    if (state && !state.pressed && !existing) {
      finish(state, source ?? target(event, state));
      return true;
    }
    element.current!.setPointerCapture(event.pointerId);
    const from = source ?? target(event);
    const line = existing ? own(board.connections ?? {}, existing.id) : null;
    put({
      from: line?.from ?? from,
      to: line?.to ?? from,
      pointer: { x: event.clientX, y: event.clientY },
      pressed: true,
      moved: false,
      existing,
    });
    return true;
  };
  const backgroundDown = (event: PointerEvent, source?: Endpoint) => {
    if (tool !== 'connect' && !current.current) return false;
    return begin(event, event.ctrlKey || event.metaKey ? undefined : source);
  };
  const move = (event: PointerEvent) => {
    const state = current.current;
    if (!state) return false;
    const end = target(event, state);
    const moved =
      state.moved ||
      (state.pressed &&
        Math.hypot(event.clientX - state.pointer.x, event.clientY - state.pointer.y) >= DRAG_START);
    put({ ...state, [state.existing?.end === 'from' ? 'from' : 'to']: end, moved });
    return true;
  };
  const up = (event: PointerEvent) => {
    const state = current.current;
    if (!state?.pressed) return false;
    if (state.moved) finish(state, target(event, state));
    else if (state.existing) put(null);
    else put({ ...state, pressed: false });
    return true;
  };
  const keyboardStart = (endpoint: Endpoint) => {
    put({ from: endpoint, to: endpoint, pointer: { x: 0, y: 0 }, pressed: false, moved: false });
    element.current?.focus();
  };
  const preview: Connection | null = draft
    ? {
        ...DEFAULT_CONNECTION,
        ...links.style,
        ...(draft.existing ? own(board.connections ?? {}, draft.existing.id) : {}),
        id: draft.existing?.id ?? '',
        from: draft.from,
        to: draft.to,
      }
    : null;
  return {
    draft: preview,
    cancel,
    backgroundDown,
    begin,
    move,
    up,
    keyboardStart,
    keyboardReconnect: (id: string, end: End) => {
      const line = own(board.connections ?? {}, id);
      if (!line || line.locked) return;
      put({
        from: line.from,
        to: line.to,
        pointer: { x: 0, y: 0 },
        pressed: false,
        moved: false,
        existing: { id, end },
      });
      element.current?.focus();
    },
    confirm: (endpoint: Endpoint) => {
      if (current.current) finish(current.current, endpoint);
    },
    active: !!draft,
  };
}
