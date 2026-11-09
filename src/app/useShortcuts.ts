import { useEffect } from 'react';
import type { BoardTool } from '../components/board/kinds';
import type { Point } from '../engine/viewport';
import { isTyping } from '../components/common/keyboard';
import { DRAFT_FIELD, draftKind } from '../components/common/drafts';
import { useLatest } from '../components/common/useStableCallback';
import type { FormatToggle } from './useNoteActions';
import type { Arrangement } from '../domain/note-actions';

export interface ShortcutHandlers {
  onUndo(): void;
  onRedo(): void;
  onDelete(): void;
  onTool(tool: BoardTool): void;
  onEscape(): void;
  onDuplicate(offset?: Point, directional?: boolean): void;
  onSelectAll(): void;
  onGroup(ungroup?: boolean): void;
  onLock(): void;
  onFormat(field: FormatToggle): void;
  onNudge(offset: Point): void;
  onSearch(): void;
  onFit(selected: boolean): void;
  onHelp(): void;
  onSave(): void;
  onOpenFile(): void;
  onArrange(action: Arrangement): void;
  onCopyStyle(): void;
  onPasteStyle(): void;
}

const FORMAT_KEYS: Readonly<Record<string, FormatToggle>> = {
  b: 'bold',
  i: 'italic',
  u: 'underline',
};
const ARROWS: Readonly<Record<string, Point>> = {
  arrowleft: { x: -1, y: 0 },
  arrowright: { x: 1, y: 0 },
  arrowup: { x: 0, y: -1 },
  arrowdown: { x: 0, y: 1 },
};
/** Shift+arrow nudges by this many pixels instead of one. */
const NUDGE_FAST = 10;
/**
 * Alignment keys, by physical key: with Option on a Mac `event.key` is a symbol (Option+A
 * types "å"), so these match `event.code`. The letters follow the common design-tool layout.
 */
const ALIGN_CODES: Readonly<Record<string, Arrangement>> = {
  KeyA: 'left',
  KeyD: 'right',
  KeyW: 'top',
  KeyS: 'bottom',
  KeyH: 'center',
  KeyV: 'middle',
};
const DISTRIBUTE_CODES: Readonly<Record<string, Arrangement>> = {
  KeyH: 'horizontal',
  KeyV: 'vertical',
};
const TOOL_KEYS: Readonly<Record<string, BoardTool>> = {
  v: 'interact',
  h: 'hand',
  n: 'sticky',
  t: 'text',
  l: 'connect',
  f: 'frame',
};

/**
 * One board shortcut. `mod` (Cmd or Ctrl), `shift` and `alt` must match when given and are
 * ignored when left out. The first binding that matches handles the key.
 */
interface Binding {
  keys: readonly string[];
  /** Physical keys (`event.code`) to match instead of `keys`. */
  codes?: readonly string[];
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
  run(handlers: ShortcutHandlers, event: KeyboardEvent, key: string): void;
}

const BINDINGS: readonly Binding[] = [
  // Before Cmd/Ctrl+C and V: with Option/Alt held these copy and paste a note's style.
  { mod: true, alt: true, keys: [], codes: ['KeyC'], run: (h) => h.onCopyStyle() },
  { mod: true, alt: true, keys: [], codes: ['KeyV'], run: (h) => h.onPasteStyle() },
  { mod: true, keys: ['z'], run: (h, e) => (e.shiftKey ? h.onRedo() : h.onUndo()) },
  { mod: true, keys: ['y'], run: (h) => h.onRedo() },
  { mod: true, keys: ['d'], run: (h) => h.onDuplicate() },
  { mod: true, keys: ['a'], run: (h) => h.onSelectAll() },
  { mod: true, keys: ['g'], run: (h, e) => h.onGroup(e.shiftKey) },
  { mod: true, shift: true, keys: ['l'], run: (h) => h.onLock() },
  { mod: true, keys: Object.keys(FORMAT_KEYS), run: (h, _, key) => h.onFormat(FORMAT_KEYS[key]) },
  { mod: true, keys: ['f'], run: (h) => h.onSearch() },
  { mod: true, keys: ['s'], run: (h) => h.onSave() },
  { mod: true, keys: ['o'], run: (h) => h.onOpenFile() },
  {
    mod: false,
    alt: true,
    shift: true,
    keys: [],
    codes: Object.keys(DISTRIBUTE_CODES),
    run: (h, e) => h.onArrange(DISTRIBUTE_CODES[e.code]),
  },
  {
    mod: false,
    alt: true,
    shift: false,
    keys: [],
    codes: Object.keys(ALIGN_CODES),
    run: (h, e) => h.onArrange(ALIGN_CODES[e.code]),
  },
  { alt: true, keys: ['1', '2'], run: (h, _, key) => h.onFit(key === '2') },
  {
    mod: false,
    keys: Object.keys(ARROWS),
    run: (h, e, key) => {
      const direction = ARROWS[key];
      // Alt+arrow duplicates one whole step in that direction; plain arrows nudge.
      if (e.altKey) return h.onDuplicate(direction, true);
      const step = e.shiftKey ? NUDGE_FAST : 1;
      h.onNudge({ x: direction.x * step, y: direction.y * step });
    },
  },
  { mod: false, keys: ['delete', 'backspace'], run: (h) => h.onDelete() },
  { mod: false, keys: ['escape'], run: (h) => h.onEscape() },
  { mod: false, keys: Object.keys(TOOL_KEYS), run: (h, _, key) => h.onTool(TOOL_KEYS[key]) },
  { keys: ['f1', '?'], run: (h) => h.onHelp() },
];

const matches = (binding: Binding, event: KeyboardEvent, key: string, mod: boolean) =>
  (binding.codes ? binding.codes.includes(event.code) : binding.keys.includes(key)) &&
  (binding.mod === undefined || binding.mod === mod) &&
  (binding.shift === undefined || binding.shift === event.shiftKey) &&
  (binding.alt === undefined || binding.alt === event.altKey);

/**
 * While typing, only Cmd/Ctrl shortcuts that act on the open field reach the board:
 * saving from any draft field, and formatting from a note's editor.
 */
function typingShortcut(handlers: ShortcutHandlers, event: KeyboardEvent, key: string): boolean {
  const field = draftKind(event.target);
  if (!field || !(event.metaKey || event.ctrlKey)) return false;
  if (key === 's') handlers.onSave();
  else if (field === DRAFT_FIELD.note && FORMAT_KEYS[key]) handlers.onFormat(FORMAT_KEYS[key]);
  else return false;
  return true;
}

/** Board-wide keys; ignored while editing text or using the preset selector. */
export function useShortcuts(handlers: ShortcutHandlers) {
  // Registered once: the listener reads the latest handlers instead of re-subscribing.
  const latest = useLatest(handlers);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      const key = event.key.toLowerCase();
      const mod = event.metaKey || event.ctrlKey;
      if (isTyping(event.target)) {
        if (typingShortcut(latest.current, event, key)) event.preventDefault();
        return;
      }
      // AltGr reports as Ctrl+Alt on Windows; it types characters (Polish ć, German @), so it
      // never runs a board shortcut such as Ctrl+Alt+C for copying a style.
      if (event.getModifierState?.('AltGraph')) return;
      const binding = BINDINGS.find((candidate) => matches(candidate, event, key, mod));
      if (!binding) return;
      binding.run(latest.current, event, key);
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [latest]);
}
