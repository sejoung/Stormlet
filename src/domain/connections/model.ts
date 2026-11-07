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
export const isFreeEndpoint = (end: Endpoint): end is { x: number; y: number } => 'x' in end;

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
export const DEFAULT_CONNECTION = {
  path: 'elbow',
  color: 'slate',
  width: 2,
  startArrow: false,
  endArrow: true,
  dashed: false,
  label: '',
} as const;
