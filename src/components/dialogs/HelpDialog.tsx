import { Modal } from './Modal';
import { useT } from '../common/i18n';
import type { MessageKey } from '../../i18n/messages';

const SHORTCUTS: readonly (readonly [action: MessageKey, keys: MessageKey])[] = [
  ['help.createFrame', 'help.createFrameKeys'],
  ['help.editFrame', 'help.editFrameKeys'],
  ['help.createConnection', 'help.createConnectionKeys'],
  ['help.editConnection', 'help.editConnectionKeys'],
  ['help.lineModifiers', 'help.lineModifiersKeys'],
  ['help.renameBoard', 'help.renameBoardKeys'],
  ['help.stickyTool', 'help.stickyToolKeys'],
  ['text.tool', 'text.shortcut'],
  ['text.helpEdit', 'text.helpEditKeys'],
  ['help.selectHandTool', 'help.selectHandToolKeys'],
  ['help.panBoard', 'help.panBoardKeys'],
  ['help.editNote', 'help.editNoteKeys'],
  ['help.newLineFinish', 'help.newLineFinishKeys'],
  ['help.nextNote', 'help.nextNoteKeys'],
  ['help.exitDeselect', 'help.exitDeselectKeys'],
  ['help.duplicate', 'help.duplicateKeys'],
  ['help.dragDuplicate', 'help.dragDuplicateKeys'],
  ['help.directionalDuplicate', 'help.directionalDuplicateKeys'],
  ['help.copyPaste', 'help.copyPasteKeys'],
  ['help.selectAll', 'help.selectAllKeys'],
  ['help.groupUngroup', 'help.groupUngroupKeys'],
  ['help.toggleLock', 'help.toggleLockKeys'],
  ['help.textStyles', 'help.textStylesKeys'],
  ['help.nudge', 'help.nudgeKeys'],
  ['help.align', 'help.alignKeys'],
  ['help.distribute', 'help.distributeKeys'],
  ['help.copyStyle', 'help.copyStyleKeys'],
  ['help.resizeModifiers', 'help.resizeModifiersKeys'],
  ['help.freeMove', 'help.freeMoveKeys'],
  ['help.undoRedo', 'help.undoRedoKeys'],
  ['help.fitNotes', 'help.fitNotesKeys'],
  ['help.searchNotes', 'help.searchNotesKeys'],
  ['help.openDownload', 'help.openDownloadKeys'],
];

export function HelpDialog({ onClose }: { onClose(): void }) {
  const t = useT();
  return (
    <Modal title={t('help.title')} onClose={onClose}>
      <dl className="shortcut-list">
        {SHORTCUTS.map(([action, keys]) => (
          <div key={action}>
            <dt>{t(action)}</dt>
            <dd>
              <kbd>{t(keys)}</kbd>
            </dd>
          </div>
        ))}
      </dl>
      <p className="help-manual">
        <a href={t('manual.path')} target="_blank" rel="noopener">
          {t('help.manual')}
        </a>
      </p>
    </Modal>
  );
}
