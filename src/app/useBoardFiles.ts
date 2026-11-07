import type { BoardStore } from '../domain/store';
import { diffBoards } from '../domain/patch';
import { boardTitle, boardFileStem, normalizeBoardTitle } from '../domain/board-title';
import { downloadText, readFileText } from '../adapters/files/download';
import { FILE_EXTENSION, parseBoard, serializeBoard } from '../adapters/files/stormlet-format';
import type { Edit } from './useBoardSession';

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
  onStatus,
}: {
  store: BoardStore;
  edit: Edit;
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
        const title = opened.title ?? titleFromFileName(file.name);
        edit((current) => diffBoards(current, { ...opened, title }));
        reset();
        onStatus(`${file.name}을(를) 열었습니다.`);
      } catch (error) {
        onStatus(`열 수 없는 파일입니다: ${(error as Error).message}`);
      }
    },
  };
}
