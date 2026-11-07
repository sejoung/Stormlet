import { useEffect, useRef } from 'react';
import { own } from '../domain/ids';
import { stackOrder, type Board } from '../domain/model';
import { internalConnections } from '../domain/connections/commands';
import { frameContents, type BoardSlice } from '../domain/frames/commands';
import { MAX_NOTE_LENGTH } from '../domain/note-details';
import { serializeBoard, parseBoard } from '../adapters/files/stormlet-format';
import {
  readClipboard,
  writeClipboard,
  type ClipboardContent,
} from '../adapters/browser/clipboard';
import {
  exceedsPasteLimits,
  MAX_PASTE_COLUMNS,
  MAX_PASTE_FRAMES,
  MAX_PASTE_NOTES,
  MAX_PASTE_ROWS,
  textCells,
  type TextCell,
} from '../engine/paste';
import type { Point } from '../engine/viewport';
import { isTyping } from '../components/common/keyboard';
import { useLatest } from '../components/common/useStableCallback';

const STORMLET_TYPE = 'application/x-stormlet';

interface Options {
  board: Board;
  ids: readonly string[];
  frameId?: string | null;
  onPaste(board: BoardSlice, at?: Point): void;
  onText(cells: TextCell[], at?: Point): void;
  onCut(): void;
  onStatus(message: string): void;
}

export interface Clipboard {
  copy(cut?: boolean): Promise<void>;
  paste(at: Point): Promise<void>;
}

const hasSelection = ({ ids, frameId }: Options) => !!ids.length || !!frameId;
const canCut = ({ board, frameId }: Options) =>
  !frameId || !own(board.frames ?? {}, frameId)?.locked;

/** What a copy of the current selection (a frame and its contents, or notes) carries. */
function selectionPayload({ board, ids, frameId }: Options): ClipboardContent {
  const picked = new Set(ids);
  const slice: BoardSlice = frameId
    ? frameContents(board, frameId)
    : {
        stickies: Object.fromEntries(
          stackOrder(board)
            .filter((note) => picked.has(note.id))
            .map((note) => [note.id, note]),
        ),
        connections: internalConnections(board, ids),
      };
  const text = Object.values(slice.stickies)
    .map((note) => note.text)
    .join('\n');
  const title = frameId ? (own(board.frames ?? {}, frameId)?.title ?? '') : '';
  return { structured: serializeBoard(slice), plain: text || title };
}

function announce({ ids, frameId, onStatus }: Options, cut: boolean) {
  const verb = cut ? '잘랐습니다' : '복사했습니다';
  onStatus(frameId ? `프레임을 ${verb}.` : `${ids.length}개의 포스트잇을 ${verb}.`);
}

const tooLarge = (board: Board) =>
  Object.keys(board.stickies).length > MAX_PASTE_NOTES ||
  Object.keys(board.frames ?? {}).length > MAX_PASTE_FRAMES;

/** Paste board content when there is some, plain text as notes otherwise. */
function accept(
  options: Options,
  content: ClipboardContent,
  last: ClipboardContent | null,
  at?: Point,
) {
  if (!content.structured && !content.plain) return;
  // Browsers without custom clipboard types still match our own last copy by its text.
  const structured = content.structured || (last?.plain === content.plain ? last.structured : '');
  try {
    if (structured) {
      const board = parseBoard(structured);
      if (tooLarge(board)) throw new Error('Too many objects');
      return options.onPaste(board, at);
    }
    options.onText(textCells(content.plain), at);
    if (exceedsPasteLimits(content.plain))
      options.onStatus(
        `붙여넣기는 최대 ${MAX_PASTE_ROWS}행 × ${MAX_PASTE_COLUMNS}열, 메모당 ${MAX_NOTE_LENGTH.toLocaleString()}자까지 반영됩니다.`,
      );
  } catch {
    options.onStatus('포스트잇을 붙여넣을 수 없습니다. 파일 형식을 확인해 주세요.');
  }
}

/**
 * Native editing uses clipboard events; menu actions use the browser's clipboard API.
 * The listeners are registered once and read the latest options through a ref.
 */
export function useClipboard(options: Options): Clipboard {
  const latest = useLatest(options);
  const cached = useRef<ClipboardContent | null>(null);

  useEffect(() => {
    const onCopy = (event: ClipboardEvent) => {
      const current = latest.current;
      const cut = event.type === 'cut';
      if (isTyping(event.target) || !event.clipboardData) return;
      if (!hasSelection(current) || (cut && !canCut(current))) return;
      const content = selectionPayload(current);
      cached.current = content;
      event.clipboardData.setData(STORMLET_TYPE, content.structured);
      event.clipboardData.setData('text/plain', content.plain);
      event.preventDefault();
      if (cut) current.onCut();
      announce(current, cut);
    };
    const onPaste = (event: ClipboardEvent) => {
      if (isTyping(event.target) || !event.clipboardData) return;
      const content = {
        structured: event.clipboardData.getData(STORMLET_TYPE),
        plain: event.clipboardData.getData('text/plain'),
      };
      if (!content.structured && !content.plain) return;
      event.preventDefault();
      accept(latest.current, content, cached.current);
    };
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      document.removeEventListener('paste', onPaste);
    };
  }, [latest]);

  return {
    copy: async (cut = false) => {
      if (!hasSelection(options) || (cut && !canCut(options))) return;
      try {
        const content = selectionPayload(options);
        await writeClipboard(content);
        cached.current = content;
        if (cut) options.onCut();
        announce(options, cut);
      } catch {
        options.onStatus('클립보드에 접근할 수 없습니다. Ctrl/Cmd+C 또는 X를 사용하세요.');
      }
    },
    paste: async (at) => {
      try {
        accept(options, await readClipboard(), cached.current, at);
      } catch {
        options.onStatus('클립보드에 접근할 수 없습니다. Ctrl/Cmd+V를 사용하세요.');
      }
    },
  };
}
