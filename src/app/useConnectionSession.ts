import { useCallback, useState } from 'react';
import { own } from '../domain/ids';
import type { Board } from '../domain/model';
import type { Patch } from '../domain/patch';
import { addConnection, deleteConnections, updateConnection } from '../domain/connections/commands';
import { DEFAULT_CONNECTION, type Endpoint } from '../domain/connections/model';
import { connectionGeometry } from '../engine/connections/geometry';
import type { ConnectionInteraction } from '../components/connections/types';

export function useConnectionSession({
  board,
  edit,
  newId,
  clearNotes,
  onTool,
  onStatus,
}: {
  board: Board;
  edit(change: (board: Board) => Patch[]): void;
  newId(): string;
  clearNotes(): void;
  onTool(): void;
  onStatus(message: string): void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState(false);
  const selected = selectedId ? (own(board.connections ?? {}, selectedId) ?? null) : null;
  const clear = useCallback(() => {
    setSelectedId(null);
    setEditingLabel(false);
  }, []);
  const onSelect = (id: string) => {
    clearNotes();
    setSelectedId(id);
    setEditingLabel(false);
  };
  const interaction: ConnectionInteraction = {
    selectedId: selected?.id ?? null,
    onSelect,
    onEditLabel: (id) => {
      onSelect(id);
      setEditingLabel(true);
    },
    onCreate: (from: Endpoint, to: Endpoint) => {
      const id = newId();
      let created = false;
      edit((current) => {
        const geometry = connectionGeometry(current, { id, from, to, ...DEFAULT_CONNECTION });
        const patches =
          geometry &&
          Math.hypot(geometry.from.x - geometry.to.x, geometry.from.y - geometry.to.y) >= 4
            ? addConnection(current, id, from, to)
            : [];
        created = patches.length > 0;
        return patches;
      });
      if (created) {
        onSelect(id);
        onTool();
      } else onStatus('서로 다른 메모나 떨어진 두 지점을 연결해 주세요.');
      return created;
    },
    onChange: (id, values) => {
      edit((current) => updateConnection(current, id, values));
      if ('label' in values) setEditingLabel(false);
    },
  };
  return {
    ...interaction,
    selected,
    editingLabel,
    clear,
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
