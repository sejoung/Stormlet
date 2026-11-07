import { own } from '../domain/ids';
import type { Board } from '../domain/model';
import { addConnection, deleteConnections, updateConnection } from '../domain/connections/commands';
import {
  DEFAULT_CONNECTION,
  type Connection,
  type ConnectionStyle,
} from '../domain/connections/model';
import { isDrawable } from '../engine/connections/geometry';
import type { ConnectionInteraction } from '../components/connections/types';
import type { Edit, EditWith } from './useBoardSession';

/** The selected connection and the commands the app runs on it. */
export interface ConnectionSession extends ConnectionInteraction {
  selected: Connection | null;
  editingLabel: boolean;
  remove(): void;
  duplicate(): void;
}

export function useConnectionSession({
  board,
  edit,
  editWith,
  newId,
  selectedId,
  editingLabel,
  onSelect,
  onLabelDone,
  onCreated,
  onStatus,
  style,
}: {
  board: Board;
  edit: Edit;
  editWith: EditWith;
  newId(): string;
  selectedId: string | null;
  editingLabel: boolean;
  onSelect(id: string, editingLabel?: boolean): void;
  onLabelDone(id: string): void;
  /** A new connection was drawn; drawing tools hand back to selection. */
  onCreated(): void;
  onStatus(message: string): void;
  style: ConnectionStyle;
}): ConnectionSession {
  const selected = selectedId ? (own(board.connections ?? {}, selectedId) ?? null) : null;
  return {
    style,
    selected,
    selectedId: selected?.id ?? null,
    editingLabel,
    onSelect: (id) => onSelect(id),
    onEditLabel: (id) => onSelect(id, true),
    onCreate: (from, to) => {
      const id = newId();
      const line = { id, from, to, ...DEFAULT_CONNECTION, ...style };
      const { patches } = editWith((current) => ({
        patches: isDrawable(current, line) ? addConnection(current, id, from, to, style) : [],
      }));
      if (!patches.length) {
        onStatus('서로 다른 메모나 떨어진 두 지점을 연결해 주세요.');
        return false;
      }
      onSelect(id);
      onCreated();
      return true;
    },
    onChange: (id, values) => {
      edit((current) => updateConnection(current, id, values));
      if ('label' in values) onLabelDone(id);
    },
    remove: () => {
      if (selected) edit((current) => deleteConnections(current, [selected.id]));
    },
    duplicate: () => {
      if (!selected) return;
      const id = newId();
      edit(() => [{ op: 'connection:add', connection: { ...selected, id, locked: false } }]);
      onSelect(id);
    },
  };
}
