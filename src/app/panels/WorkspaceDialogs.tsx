import type { Board } from '../../domain/model';
import { BulkDialog } from '../../components/dialogs/BulkDialog';
import { HelpDialog } from '../../components/dialogs/HelpDialog';
import { DiagnosticsDialog } from '../../components/dialogs/DiagnosticsDialog';
import { NewBoardDialog } from '../../components/dialogs/NewBoardDialog';
import { isEmptyBoard } from '../../domain/model';
import type { BoardLibrary } from '../../domain/store';
import { RecentBoardsDialog } from '../../components/dialogs/RecentBoardsDialog';
import { DriveDialog } from '../../components/drive/DriveDialog';
import { DriveConflictDialog } from '../../components/drive/DriveConflictDialog';
import { DisconnectDialog } from '../../components/drive/DisconnectDialog';
import type { Diagnostics } from '../diagnostics/diagnostics';
import type { Drive } from '../drive/useDrive';

export type DialogName =
  'new' | 'recent' | 'disconnect' | 'bulk' | 'help' | 'diagnostics' | 'drive' | 'conflict';

interface Props {
  dialog: DialogName | null;
  onDialog(dialog: DialogName | null): void;
  board: Board;
  onBulkAdd(texts: string[]): void;
  /** Other boards in this browser, and starting or downloading this tab's board. */
  boards: { library?: BoardLibrary; create(title: string): void; download(): void };
  diagnostics: Diagnostics;
  drive: Drive;
}

/** The workspace's modal dialogs; at most one is open. */
export function WorkspaceDialogs({ dialog, onDialog, drive, boards, ...props }: Props) {
  const close = () => onDialog(null);
  const { library } = boards;
  const empty = isEmptyBoard(props.board);
  switch (dialog) {
    case 'new':
      return (
        <NewBoardDialog
          hasWork={!empty}
          inNewTab={!empty && library !== undefined}
          driveFile={'file' in drive.state ? drive.state.file.name : null}
          onDownload={boards.download}
          onCreate={(title) => {
            close();
            if (!empty && library) return library.startInTab(title);
            void drive.release().then((released) => released && boards.create(title));
          }}
          onClose={close}
        />
      );
    case 'recent':
      return library ? (
        <RecentBoardsDialog
          load={library.closed.bind(library)}
          here={empty && !('file' in drive.state)}
          onOpen={(id) => library.open(id, empty && !('file' in drive.state) ? 'here' : 'tab')}
          onRemove={library.remove.bind(library)}
          onClose={close}
        />
      ) : null;
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
          onRelink={() => {
            close();
            drive.relink();
          }}
          onDisconnect={() => onDialog('disconnect')}
          onClose={close}
        />
      );
    case 'disconnect':
      return <DisconnectDialog onDisconnect={drive.disconnect} onClose={close} />;
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
