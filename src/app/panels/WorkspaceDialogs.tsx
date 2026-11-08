import type { Board } from '../../domain/model';
import { BulkDialog } from '../../components/dialogs/BulkDialog';
import { HelpDialog } from '../../components/dialogs/HelpDialog';
import { DiagnosticsDialog } from '../../components/dialogs/DiagnosticsDialog';
import { NewBoardDialog } from '../../components/dialogs/NewBoardDialog';
import { isEmptyBoard } from '../../domain/model';
import { DriveDialog } from '../../components/drive/DriveDialog';
import { DriveConflictDialog } from '../../components/drive/DriveConflictDialog';
import type { Diagnostics } from '../diagnostics/diagnostics';
import type { Drive } from '../drive/useDrive';

export type DialogName = 'new' | 'bulk' | 'help' | 'diagnostics' | 'drive' | 'conflict';

interface Props {
  dialog: DialogName | null;
  onDialog(dialog: DialogName | null): void;
  board: Board;
  onBulkAdd(texts: string[]): void;
  onNewBoard(title: string): void;
  onDownload(): void;
  diagnostics: Diagnostics;
  drive: Drive;
}

/** The workspace's modal dialogs; at most one is open. */
export function WorkspaceDialogs({ dialog, onDialog, drive, ...props }: Props) {
  const close = () => onDialog(null);
  switch (dialog) {
    case 'new':
      return (
        <NewBoardDialog
          hasWork={!isEmptyBoard(props.board)}
          driveFile={'file' in drive.state ? drive.state.file.name : null}
          onDownload={props.onDownload}
          onCreate={(title) => {
            close();
            void drive.release().then((released) => released && props.onNewBoard(title));
          }}
          onClose={close}
        />
      );
    case 'bulk':
      return <BulkDialog onClose={close} onAdd={props.onBulkAdd} />;
    case 'help':
      return <HelpDialog onClose={close} />;
    case 'diagnostics':
      return <DiagnosticsDialog diagnostics={props.diagnostics} onClose={close} />;
    case 'drive':
      return (
        <DriveDialog
          state={drive.state}
          connected={drive.connected}
          ready={drive.ready}
          busy={drive.busy}
          onPrepare={drive.prepare}
          onConnect={drive.connect}
          onSaveNow={drive.saveNow}
          onResolve={() => onDialog('conflict')}
          onUnlink={drive.unlink}
          onDisconnect={drive.disconnect}
          onClose={close}
        />
      );
    case 'conflict':
      return drive.state.status === 'conflict' ? (
        <DriveConflictDialog
          conflicts={drive.state.conflicts}
          board={props.board}
          onResolve={(choices) => {
            close();
            drive.resolve(choices);
          }}
          onClose={close}
        />
      ) : null;
    default:
      return null;
  }
}
