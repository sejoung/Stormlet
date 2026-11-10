import type { Board } from '../domain/model';
import type { BoardLibrary, BoardStore } from '../domain/store';
import { diffBoards } from '../domain/patch';
import { boardTitle, boardFileStem, normalizeBoardTitle } from '../domain/board-title';
import { emptyBoard, isEmptyBoard } from '../domain/model';
import { downloadBlob, downloadText, readFileText } from '../adapters/files/download';
import { canvasTextMeasure, svgToPng } from '../adapters/files/image-export';
import { boardSvg } from '../components/export/board-svg';
import type { ImageFormat } from '../components/menus/FileMenu';
import {
  FILE_EXTENSION,
  MAX_BOARD_FILE_BYTES,
  parseBoard,
  serializeBoard,
} from '../adapters/files/stormlet-format';
import { errorDetails, log } from '../adapters/diagnostics/log';
import type { Edit } from './useBoardSession';
import { useT } from '../components/common/i18n';

/** Download `board` as a `.stormlet` file named after its title. */
export function downloadBoard(board: Board): void {
  downloadText(`${boardFileStem(boardTitle(board))}${FILE_EXTENSION}`, serializeBoard(board));
}

/** A file's name without the board extension, as a title for boards saved without one. */
const titleFromFileName = (name: string) =>
  normalizeBoardTitle(
    name.toLowerCase().endsWith(FILE_EXTENSION) ? name.slice(0, -FILE_EXTENSION.length) : name,
  );

export function useBoardFiles({
  store,
  library,
  edit,
  restart,
  flushEditor,
  reset,
  beforeOpen,
  onStatus,
}: {
  store: BoardStore;
  /** Where a board opened over from Drive is kept, since that cannot be undone. */
  library?: BoardLibrary;
  edit: Edit;
  /** Replaces the board and clears undo and redo. */
  restart: Edit;
  flushEditor(): void;
  reset(): void;
  /**
   * Called before a local file replaces the board, e.g. to save and stop syncing the
   * previous Drive file; false keeps the board and cancels opening.
   */
  beforeOpen?(): Promise<boolean>;
  onStatus(message: string): void;
}) {
  const t = useT();
  /** Put `opened` on the board, titled after `name` if it has no title. */
  const replace = (opened: Board, name: string, change: Edit) => {
    const title = opened.title ?? titleFromFileName(name);
    change((current) => diffBoards(current, { ...opened, title }));
    reset();
  };
  return {
    /**
     * Put a board opened from Drive in place, after `link` links its file, with no undo
     * back to the previous board: undoing would save the old board over the opened file.
     * So a previous board that is only in this browser is kept in Recent boards first, and
     * nothing is opened when it cannot be kept.
     */
    startFrom: (opened: Board, name: string, link: () => void, inDrive: boolean) => {
      const previous = store.load();
      const keep = !inDrive && !isEmptyBoard(previous) && library !== undefined;
      if (keep && !library.keep(previous)) return false;
      link();
      replace(opened, name, restart);
      return keep ? ('kept' as const) : ('replaced' as const);
    },
    /**
     * Start an empty board named `title` (the default name when blank), as one undoable
     * edit. The caller has already saved and stopped syncing the previous Drive file.
     */
    newBoard: (title: string) => {
      flushEditor();
      edit((current) =>
        diffBoards(current, { ...emptyBoard(), title: normalizeBoardTitle(title) }),
      );
      reset();
      log.info('files.new-board');
      onStatus(t('files.newBoard'));
    },
    save: () => {
      flushEditor();
      downloadBoard(store.load());
      log.info('files.downloaded');
    },
    /** Download the board as a PNG or SVG picture named after its title. */
    exportImage: async (format: ImageFormat) => {
      flushEditor();
      const board = store.load();
      const name = `${boardFileStem(boardTitle(board))}.${format}`;
      try {
        const image = boardSvg(board, canvasTextMeasure());
        if (!image) return;
        if (format === 'svg') downloadText(name, image.svg, 'image/svg+xml');
        else downloadBlob(name, await svgToPng(image.svg, image.width, image.height));
        log.info('files.exported', { format });
        onStatus(t('files.exported', { name }));
      } catch (error) {
        log.warn('files.export-failed', { format, ...errorDetails(error, false) });
        onStatus(t('files.exportFailed'));
      }
    },
    onOpen: async (file: File) => {
      try {
        // A huge file would freeze the page while it is read; boards are far smaller.
        if (file.size > MAX_BOARD_FILE_BYTES)
          throw new Error(t('files.tooLarge', { size: MAX_BOARD_FILE_BYTES / 1024 / 1024 }));
        const opened = parseBoard(await readFileText(file));
        if (beforeOpen && !(await beforeOpen())) return;
        // Undoable: the previous Drive file is no longer linked, so nothing is saved back.
        replace(opened, file.name, edit);
        log.info('files.opened', { size: file.size });
        onStatus(t('files.opened', { name: file.name }));
      } catch (error) {
        log.warn('files.open-failed', { size: file.size, ...errorDetails(error) });
        onStatus(t('files.openFailed', { reason: (error as Error).message }));
      }
    },
  };
}
