import { own } from '../domain/ids';
import type { Board } from '../domain/model';
import type { Patch } from '../domain/patch';
import {
  addConnection,
  deleteConnections,
  restyleConnections,
  updateConnection,
} from '../domain/connections/commands';
import {
  DEFAULT_CONNECTION,
  SHARED_STROKE_FIELDS,
  type Connection,
  type ConnectionStyle,
} from '../domain/connections/model';
import { isDrawable } from '../engine/connections/geometry';
import type { ConnectionInteraction } from '../components/connections/types';
import type { Edit, EditWith } from './useBoardSession';
import { useT } from '../components/common/i18n';

/** The selected connection and the commands the app runs on it. */
export interface ConnectionSession extends ConnectionInteraction {
  selected: Connection | null;
  editingLabel: boolean;
  remove(): void;
  duplicate(): void;
  /** Copy the selected line's colour, width and dash to every unlocked line. */
  applyStrokeToAll(): void;
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
  defaults,
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
  /** Creation defaults: new lines take `connection`; stroke edits update it via `onConnection`. */
  defaults: { connection: ConnectionStyle; onConnection(style: Partial<ConnectionStyle>): void };
}): ConnectionSession {
  const t = useT();
  const style = defaults.connection;
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
        onStatus(t('connectionSession.invalid'));
        return false;
      }
      onSelect(id);
      onCreated();
      return true;
    },
    onChange: (id, values) => {
      const { patches } = editWith((current) => ({
        patches: updateConnection(current, id, values),
      }));
      // A line's stroke look becomes the default, so the next line drawn matches it.
      const stroke = Object.fromEntries(
        SHARED_STROKE_FIELDS.filter((field) => field in values).map((f) => [f, values[f]]),
      );
      if (patches.length && Object.keys(stroke).length) defaults.onConnection(stroke);
      if ('label' in values) onLabelDone(id);
    },
    remove: () => {
      if (selected) edit((current) => deleteConnections(current, [selected.id]));
    },
    applyStrokeToAll: () => {
      if (!selected) return;
      const { color, width, dashed } = selected;
      const { patches } = editWith((current) => ({
        patches: restyleConnections(current, { color, width, dashed }),
      }));
      const count = new Set(patches.map(lineOf)).size;
      onStatus(
        count ? t('connectionSession.restyled', { count }) : t('connectionSession.sameStroke'),
      );
    },
    duplicate: () => {
      if (!selected) return;
      const id = newId();
      edit(() => [{ op: 'connection:add', connection: { ...selected, id, locked: false } }]);
      onSelect(id);
    },
  };
}

const lineOf = (patch: Patch) => ('id' in patch ? patch.id : '');
