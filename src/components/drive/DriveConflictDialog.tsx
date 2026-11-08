import { useState } from 'react';
import type { Board } from '../../domain/model';
import { DEFAULT_BOARD_TITLE } from '../../domain/board-title';
import type { Conflict, Side } from '../../domain/sync/merge';
import type { Translate } from '../../i18n/messages';
import { Modal } from '../dialogs/Modal';
import { useT } from '../common/i18n';

const SNIPPET = 40;
const snippet = (value: unknown) => {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > SNIPPET ? `${text.slice(0, SNIPPET)}…` : text;
};
const FIELDS: Record<string, Parameters<Translate>[0]> = {
  text: 'drive.field.text',
  title: 'drive.field.title',
  label: 'drive.field.label',
  color: 'drive.field.color',
  position: 'drive.field.position',
  size: 'drive.field.size',
};

/** Which record a conflict is about, named as the user knows it. */
function subject(conflict: Conflict, board: Board, t: Translate): string {
  if (conflict.collection === 'title') return t('drive.conflict.boardTitle');
  const record = (board[conflict.collection]?.[conflict.id!] ??
    conflict.local ??
    conflict.remote) as Record<string, unknown> | undefined;
  const item =
    conflict.collection === 'stickies'
      ? t('drive.conflict.note', { name: snippet(record?.text) || t('note.empty') })
      : conflict.collection === 'frames'
        ? t('drive.conflict.frame', { name: snippet(record?.title) })
        : t('drive.conflict.connector');
  if (!conflict.field) return item;
  const field = FIELDS[conflict.field];
  return t('drive.conflict.field', {
    item,
    field: field ? t(field) : t('drive.field.other'),
  });
}

/** One side's value, short enough to compare at a glance. */
function value(conflict: Conflict, side: Side, t: Translate): string {
  const raw = conflict[side];
  if (conflict.collection === 'title') return snippet(raw ?? DEFAULT_BOARD_TITLE);
  if (!conflict.field)
    return raw === undefined ? t('drive.conflict.deleted') : t('drive.conflict.changed');
  const values = raw as unknown[];
  switch (conflict.field) {
    case 'text':
    case 'title':
    case 'label':
      return snippet(values[0]) || '—';
    case 'color':
      return String(values[0]);
    case 'position':
      return values.map((part) => Math.round(Number(part))).join(', ');
    case 'size':
      return values.map((part) => Math.round(Number(part))).join(' × ');
    default:
      return t('drive.conflict.changed');
  }
}

/**
 * Both this editor and someone else changed the same things in the Drive file. Everything
 * else was merged already; here the user picks a side for each conflict (mine by default).
 */
export function DriveConflictDialog({
  conflicts,
  board,
  onResolve,
  onClose,
}: {
  conflicts: readonly Conflict[];
  board: Board;
  onResolve(choices: Record<string, Side>): void;
  onClose(): void;
}) {
  const t = useT();
  const [choices, setChoices] = useState<Record<string, Side>>({});
  const all = (side: Side) =>
    setChoices(Object.fromEntries(conflicts.map((conflict) => [conflict.key, side])));
  return (
    <Modal title={t('drive.conflict.title')} onClose={onClose}>
      <p className="modal-description">{t('drive.conflict.description')}</p>
      <div className="conflict-list">
        {conflicts.map((conflict) => (
          <fieldset key={conflict.key} className="conflict-item">
            <legend>{subject(conflict, board, t)}</legend>
            {(['local', 'remote'] as const).map((side) => (
              <label key={side} className="settings-option">
                <input
                  type="radio"
                  name={conflict.key}
                  checked={(choices[conflict.key] ?? 'local') === side}
                  onChange={() => setChoices({ ...choices, [conflict.key]: side })}
                />
                <span className="conflict-side">
                  {side === 'local' ? t('drive.conflict.mine') : t('drive.conflict.theirs')}
                </span>
                <span className="conflict-value">{value(conflict, side, t)}</span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <footer>
        <button type="button" onClick={() => all('local')}>
          {t('drive.conflict.allMine')}
        </button>
        <button type="button" onClick={() => all('remote')}>
          {t('drive.conflict.allTheirs')}
        </button>
        <button type="button" className="primary-button" onClick={() => onResolve(choices)}>
          {t('drive.conflict.apply')}
        </button>
      </footer>
    </Modal>
  );
}
