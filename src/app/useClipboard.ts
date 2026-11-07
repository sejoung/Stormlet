import { useCallback, useEffect, useRef } from 'react';
import { stackOrder, type Board } from '../domain/model';
import { internalConnections } from '../domain/connections/commands';
import { serializeBoard, parseBoard } from '../adapters/files/stormlet-format';
import {
  readClipboard,
  writeClipboard,
  type ClipboardContent,
} from '../adapters/browser/clipboard';
import { textCells, type TextCell } from '../engine/paste';
import type { Point } from '../engine/viewport';
import { isTyping } from './useShortcuts';
import { frameContents } from '../domain/frames/commands';

interface Options {
  board: Board;
  ids: string[];
  frameId?: string | null;
  onPaste(board: Board, at?: Point): void;
  onText(cells: TextCell[], at?: Point): void;
  onCut(): void;
  onStatus(message: string): void;
}

/** Native editing uses clipboard events; menu actions use the browser's clipboard API. */
export function useClipboard(options: Options) {
  const cached = useRef<ClipboardContent | null>(null);
  const payload = useCallback((): ClipboardContent => {
    const notes = stackOrder(options.board).filter((note) => options.ids.includes(note.id));
    const board = options.frameId
      ? frameContents(options.board, options.frameId)
      : {
          stickies: Object.fromEntries(notes.map((note) => [note.id, note])),
          connections: internalConnections(options.board, options.ids),
        };
    return {
      structured: serializeBoard(board),
      plain:
        Object.values(board.stickies)
          .map((note) => note.text)
          .join('\n') ||
        (options.frameId ? (options.board.frames?.[options.frameId]?.title ?? '') : ''),
    };
  }, [options]);
  const accept = useCallback(
    (content: ClipboardContent, at?: Point) => {
      if (!content.structured && !content.plain) return;
      const structured =
        content.structured ||
        (cached.current?.plain === content.plain ? cached.current.structured : '');
      if (!structured && !content.plain) return;
      try {
        if (structured) {
          const board = parseBoard(structured);
          if (
            Object.keys(board.stickies).length > 5000 ||
            Object.keys(board.frames ?? {}).length > 1000
          )
            throw new Error('Too many objects');
          options.onPaste(board, at);
        } else {
          options.onText(textCells(content.plain), at);
          if (content.plain.length > 3000 || content.plain.split('\n').length > 50)
            options.onStatus('붙여넣기는 최대 50행 × 100열, 메모당 3,000자까지 반영됩니다.');
        }
      } catch {
        options.onStatus('포스트잇을 붙여넣을 수 없습니다. 파일 형식을 확인해 주세요.');
      }
    },
    [options],
  );
  const canCut = !options.frameId || !options.board.frames?.[options.frameId]?.locked;
  const announce = useCallback(
    (cut: boolean) =>
      options.onStatus(
        options.frameId
          ? `프레임을 ${cut ? '잘랐습니다' : '복사했습니다'}.`
          : `${options.ids.length}개의 포스트잇을 ${cut ? '잘랐습니다' : '복사했습니다'}.`,
      ),
    [options],
  );
  useEffect(() => {
    const copy = (event: ClipboardEvent) => {
      if (
        isTyping(event.target) ||
        !event.clipboardData ||
        (!options.ids.length && !options.frameId) ||
        (event.type === 'cut' && !canCut)
      )
        return;
      const content = payload();
      cached.current = content;
      event.clipboardData.setData('application/x-stormlet', content.structured);
      event.clipboardData.setData('text/plain', content.plain);
      event.preventDefault();
      if (event.type === 'cut') options.onCut();
      announce(event.type === 'cut');
    };
    const paste = (event: ClipboardEvent) => {
      if (isTyping(event.target) || !event.clipboardData) return;
      const content = {
        structured: event.clipboardData.getData('application/x-stormlet'),
        plain: event.clipboardData.getData('text/plain'),
      };
      if (!content.structured && !content.plain && !cached.current) return;
      event.preventDefault();
      accept(content);
    };
    document.addEventListener('copy', copy);
    document.addEventListener('cut', copy);
    document.addEventListener('paste', paste);
    return () => {
      document.removeEventListener('copy', copy);
      document.removeEventListener('cut', copy);
      document.removeEventListener('paste', paste);
    };
  }, [options, payload, accept, canCut, announce]);
  return {
    copy: async (cut = false) => {
      if ((!options.ids.length && !options.frameId) || (cut && !canCut)) return;
      try {
        const content = payload();
        await writeClipboard(content);
        cached.current = content;
        if (cut) options.onCut();
        announce(cut);
      } catch {
        options.onStatus('클립보드에 접근할 수 없습니다. Ctrl/Cmd+C 또는 X를 사용하세요.');
      }
    },
    paste: async (at: Point) => {
      try {
        accept(await readClipboard(), at);
      } catch {
        options.onStatus('클립보드에 접근할 수 없습니다. Ctrl/Cmd+V를 사용하세요.');
      }
    },
  };
}
