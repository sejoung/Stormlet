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
import { useT } from '../components/common/i18n';
import type { Translate } from '../i18n/messages';

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

function announce({ ids, frameId, onStatus }: Options, cut: boolean, t: Translate) {
  if (frameId) onStatus(t(cut ? 'clipboard.cutFrame' : 'clipboard.copiedFrame'));
  else onStatus(t(cut ? 'clipboard.cutNotes' : 'clipboard.copiedNotes', { count: ids.length }));
}

const tooLarge = (board: Board) =>
  Object.keys(board.stickies).length > MAX_PASTE_NOTES ||
  Object.keys(board.frames ?? {}).length > MAX_PASTE_FRAMES;

/** Paste board content when there is some, plain text as notes otherwise. */
function accept(
  options: Options,
  content: ClipboardContent,
  last: ClipboardContent | null,
  t: Translate,
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
        t('clipboard.pasteLimits', {
          rows: MAX_PASTE_ROWS,
          columns: MAX_PASTE_COLUMNS,
          length: MAX_NOTE_LENGTH.toLocaleString(),
        }),
      );
  } catch {
    options.onStatus(t('clipboard.pasteFailed'));
  }
}

/**
 * Native editing uses clipboard events; menu actions use the browser's clipboard API.
 * The listeners are registered once per language and read the latest options through a ref.
 */
export function useClipboard(options: Options): Clipboard {
  const t = useT();
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
      announce(current, cut, t);
    };
    const onPaste = (event: ClipboardEvent) => {
      if (isTyping(event.target) || !event.clipboardData) return;
      const content = {
        structured: event.clipboardData.getData(STORMLET_TYPE),
        plain: event.clipboardData.getData('text/plain'),
      };
      if (!content.structured && !content.plain) return;
      event.preventDefault();
      accept(latest.current, content, cached.current, t);
    };
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      document.removeEventListener('paste', onPaste);
    };
  }, [latest, t]);

  return {
    copy: async (cut = false) => {
      if (!hasSelection(options) || (cut && !canCut(options))) return;
      try {
        const content = selectionPayload(options);
        await writeClipboard(content);
        cached.current = content;
        if (cut) options.onCut();
        announce(options, cut, t);
      } catch {
        options.onStatus(t('clipboard.copyUnavailable'));
      }
    },
    paste: async (at) => {
      try {
        accept(options, await readClipboard(), cached.current, t, at);
      } catch {
        options.onStatus(t('clipboard.pasteUnavailable'));
      }
    },
  };
}
