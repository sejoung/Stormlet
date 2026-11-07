import { useEffect } from 'react';
import { stackOrder, type Board } from '../domain/model';
import { internalConnections } from '../domain/connections/commands';
import { serializeBoard, parseBoard } from '../adapters/files/stormlet-format';
import { textCells, type TextCell } from '../engine/paste';
import { isTyping } from './useShortcuts';
import { frameContents } from '../domain/frames/commands';

interface Options {
  board: Board;
  ids: string[];
  frameId?: string | null;
  onPaste(board: Board): void;
  onText(cells: TextCell[]): void;
  onCut(): void;
  onStatus(message: string): void;
}

/** Uses trusted clipboard events, so text editing and browser permissions stay native. */
export function useClipboard(options: Options) {
  useEffect(() => {
    const copy = (event: ClipboardEvent) => {
      if (
        isTyping(event.target) ||
        !event.clipboardData ||
        (!options.ids.length && !options.frameId)
      )
        return;
      if (
        options.frameId &&
        event.type === 'cut' &&
        options.board.frames?.[options.frameId]?.locked
      )
        return;
      const notes = stackOrder(options.board).filter((s) => options.ids.includes(s.id));
      const board = options.frameId
        ? frameContents(options.board, options.frameId)
        : {
            stickies: Object.fromEntries(notes.map((s) => [s.id, s])),
            connections: internalConnections(options.board, options.ids),
          };
      event.clipboardData.setData('application/x-stormlet', serializeBoard(board));
      event.clipboardData.setData(
        'text/plain',
        Object.values(board.stickies)
          .map((s) => s.text)
          .join('\n'),
      );
      event.preventDefault();
      if (event.type === 'cut') options.onCut();
      if (options.frameId)
        options.onStatus(event.type === 'cut' ? '프레임을 잘랐습니다.' : '프레임을 복사했습니다.');
      else
        options.onStatus(
          `${notes.length}개의 포스트잇을 ${event.type === 'cut' ? '잘랐습니다' : '복사했습니다'}.`,
        );
    };
    const paste = (event: ClipboardEvent) => {
      if (isTyping(event.target) || !event.clipboardData) return;
      const structured = event.clipboardData.getData('application/x-stormlet');
      const plain = event.clipboardData.getData('text/plain');
      if (!structured && !plain) return;
      event.preventDefault();
      try {
        if (structured) {
          const board = parseBoard(structured);
          if (Object.keys(board.stickies).length > 5000) throw new Error('Too many notes');
          if (Object.keys(board.frames ?? {}).length > 1000) throw new Error('Too many frames');
          options.onPaste(board);
        } else {
          options.onText(textCells(plain));
          if (plain.length > 3000 || plain.split('\n').length > 50)
            options.onStatus('붙여넣기는 최대 50행 × 100열, 메모당 3,000자까지 반영됩니다.');
        }
      } catch {
        options.onStatus('포스트잇을 붙여넣을 수 없습니다. 파일 형식을 확인해 주세요.');
      }
    };
    document.addEventListener('copy', copy);
    document.addEventListener('cut', copy);
    document.addEventListener('paste', paste);
    return () => {
      document.removeEventListener('copy', copy);
      document.removeEventListener('cut', copy);
      document.removeEventListener('paste', paste);
    };
  }, [options]);
}
