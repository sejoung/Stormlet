export const CONNECTION_COLORS = ['slate', 'blue', 'red', 'green', 'purple'] as const;
export type ConnectionColor = (typeof CONNECTION_COLORS)[number];
export const CONNECTION_PATHS = ['straight', 'elbow', 'curve'] as const;
export type ConnectionPath = (typeof CONNECTION_PATHS)[number];
export const CONNECTION_SIDES = ['auto', 'top', 'right', 'bottom', 'left'] as const;
export type ConnectionSide = (typeof CONNECTION_SIDES)[number];
export type Endpoint =
  | { stickyId: string; side: ConnectionSide }
  | { frameId: string; side: ConnectionSide }
  | { x: number; y: number };
export type FreeEndpoint = { x: number; y: number };
export const isFreeEndpoint = (end: Endpoint): end is FreeEndpoint => 'x' in end;
/** ID of the note an endpoint is attached to, if any. */
export const stickyOf = (end: Endpoint): string | undefined =>
  'stickyId' in end ? end.stickyId : undefined;
/** ID of the frame an endpoint is attached to, if any. */
export const frameOf = (end: Endpoint): string | undefined =>
  'frameId' in end ? end.frameId : undefined;

/** One branch per endpoint shape, so callers never repeat the `'stickyId' in end` checks. */
export function matchEndpoint<T>(
  end: Endpoint,
  cases: { sticky(id: string): T; frame(id: string): T; free(point: FreeEndpoint): T },
): T {
  if ('stickyId' in end) return cases.sticky(end.stickyId);
  if ('frameId' in end) return cases.frame(end.frameId);
  return cases.free(end);
}

const touches = (
  line: Connection,
  idOf: (end: Endpoint) => string | undefined,
  ids: ReadonlySet<string>,
) =>
  [line.from, line.to].some((end) => {
    const id = idOf(end);
    return id !== undefined && ids.has(id);
  });
/** Whether either end of `line` is attached to a note in `ids`. */
export const touchesStickies = (line: Connection, ids: ReadonlySet<string>): boolean =>
  touches(line, stickyOf, ids);
/** Whether either end of `line` is attached to a frame in `ids`. */
export const touchesFrames = (line: Connection, ids: ReadonlySet<string>): boolean =>
  touches(line, frameOf, ids);
/** Whether both ends of `line` are attached to notes in `ids`. */
export const joinsStickies = (line: Connection, ids: ReadonlySet<string>): boolean =>
  [line.from, line.to].every((end) => {
    const id = stickyOf(end);
    return id !== undefined && ids.has(id);
  });

export interface Connection {
  id: string;
  from: Endpoint;
  to: Endpoint;
  path: ConnectionPath;
  color: ConnectionColor;
  width: number;
  startArrow: boolean;
  endArrow: boolean;
  dashed: boolean;
  label: string;
  locked?: boolean;
}
export type ConnectionStyle = Pick<
  Connection,
  'path' | 'color' | 'width' | 'startArrow' | 'endArrow' | 'dashed'
>;
export const CONNECTION_FIELDS = [
  'from',
  'to',
  'path',
  'color',
  'width',
  'startArrow',
  'endArrow',
  'dashed',
  'label',
  'locked',
] as const;
export type ConnectionField = (typeof CONNECTION_FIELDS)[number];
export type ConnectionSetPatch = {
  [F in ConnectionField]: { op: 'connection:set'; id: string; field: F; value: Connection[F] };
}[ConnectionField];
export type ConnectionPatch =
  | { op: 'connection:add'; connection: Connection }
  | ConnectionSetPatch
  | { op: 'connection:delete'; id: string };
export const CONNECTION_WIDTHS = [1, 2, 3, 4, 6] as const;
export const isConnectionWidth = (value: unknown): value is number =>
  (CONNECTION_WIDTHS as readonly unknown[]).includes(value);
export const MAX_CONNECTION_LABEL_LENGTH = 300;
export const DEFAULT_CONNECTION = {
  path: 'elbow',
  color: 'slate',
  width: 2,
  startArrow: false,
  endArrow: true,
  dashed: false,
  label: '',
} as const;
