import type { Board } from '../domain/model';
import type { BoardStore } from '../domain/store';
import type { Patch } from '../domain/patch';
import { diffBoards } from '../domain/patch';
import { boardTitle, boardFileStem, normalizeBoardTitle } from '../domain/board-title';
import { downloadText, readFileText } from '../adapters/files/download';
import { FILE_EXTENSION, parseBoard, serializeBoard } from '../adapters/files/stormlet-format';

export function useBoardFiles({
  store,
  edit,
  flushEditor,
  reset,
  onStatus,
}: {
  store: BoardStore;
  edit(change: (board: Board) => Patch[]): void;
  flushEditor(): void;
  reset(): void;
  onStatus(message: string): void;
}) {
  return {
    save: () => {
      flushEditor();
      const current = store.load();
      downloadText(
        `${boardFileStem(boardTitle(current))}${FILE_EXTENSION}`,
        serializeBoard(current),
      );
    },
    onOpen: async (file: File) => {
      try {
        const opened = parseBoard(await readFileText(file));
        const title = opened.title ?? normalizeBoardTitle(file.name.replace(/\.stormlet$/i, ''));
        edit((current) => diffBoards(current, { ...opened, title }));
        reset();
        onStatus(`${file.name}을(를) 열었습니다.`);
      } catch (error) {
        onStatus(`열 수 없는 파일입니다: ${(error as Error).message}`);
      }
    },
  };
}
