import { DEFAULT_CONNECTION, type Connection } from '../../src/domain/connections/model';
import type { Board } from '../../src/domain/model';
import { boardOf, sticky } from './boards';

export const connection = (id = 'line', extra: Partial<Connection> = {}): Connection => ({
  id,
  from: { stickyId: 'a', side: 'auto' },
  to: { stickyId: 'b', side: 'auto' },
  ...DEFAULT_CONNECTION,
  ...extra,
});
export const connectedBoard = (line = connection()): Board => ({
  ...boardOf(sticky('a'), sticky('b', { x: 400, y: 200 }), sticky('c', { x: 800 })),
  connections: { [line.id]: line },
});
