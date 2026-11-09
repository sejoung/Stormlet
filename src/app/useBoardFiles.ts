import type { Board } from '../domain/model';
import type { BoardStore } from '../domain/store';
import { diffBoards } from '../domain/patch';
import { boardTitle, boardFileStem, normalizeBoardTitle } from '../domain/board-title';
import { emptyBoard } from '../domain/model';
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
  edit,
  flushEditor,
  reset,
  beforeOpen,
  onStatus,
}: {
  store: BoardStore;
  edit: Edit;
  flushEditor(): void;
  reset(): void;
  /** Called before a local file replaces the board, e.g. to stop syncing the previous file. */
  beforeOpen?(): void;
  onStatus(message: string): void;
}) {
  const t = useT();
  /** Put `opened` on the board as an undoable edit, titled after `name` if it has no title. */
  const replace = (opened: Board, name: string) => {
    const title = opened.title ?? titleFromFileName(name);
    edit((current) => diffBoards(current, { ...opened, title }));
    reset();
  };
  return {
    replace,
    /** Start an empty board named `title` (the default name when blank), as one undoable edit. */
    newBoard: (title: string) => {
      flushEditor();
      beforeOpen?.();
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
        beforeOpen?.();
        replace(opened, file.name);
        log.info('files.opened', { size: file.size });
        onStatus(t('files.opened', { name: file.name }));
      } catch (error) {
        log.warn('files.open-failed', { size: file.size, ...errorDetails(error) });
        onStatus(t('files.openFailed', { reason: (error as Error).message }));
      }
    },
  };
}
