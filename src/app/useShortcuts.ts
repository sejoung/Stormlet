import { useEffect } from 'react';
import type { BoardTool } from '../components/board/kinds';

interface Handlers {
  onUndo(): void;
  onRedo(): void;
  onDelete(): void;
  onPalette(index: number): void;
  onTool(tool: BoardTool): void;
  onEscape(): void;
}

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  target.closest('input, textarea, select, [contenteditable]') !== null;

/** Board-wide keys; ignored while editing text or using the preset selector. */
export function useShortcuts(handlers: Handlers) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (typing(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && key === 'z') handlers[event.shiftKey ? 'onRedo' : 'onUndo']();
      else if (mod && key === 'y') handlers.onRedo();
      else if (!mod && (key === 'delete' || key === 'backspace')) handlers.onDelete();
      else if (!mod && key === 'escape') handlers.onEscape();
      else if (!mod && key === 'v') handlers.onTool('select');
      else if (!mod && key === 'h') handlers.onTool('pan');
      else if (!mod && /^[1-8]$/.test(key)) handlers.onPalette(Number(key) - 1);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}
