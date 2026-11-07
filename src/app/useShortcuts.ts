import { useEffect } from 'react';
import type { BoardTool } from '../components/board/kinds';
import type { Point } from '../engine/viewport';

interface Handlers {
  onUndo(): void;
  onRedo(): void;
  onDelete(): void;
  onTool(tool: BoardTool): void;
  onEscape(): void;
  onDuplicate(offset?: Point, directional?: boolean): void;
  onSelectAll(): void;
  onGroup(ungroup?: boolean): void;
  onLock(): void;
  onFormat(field: 'bold' | 'italic' | 'underline'): void;
  onNudge(offset: Point): void;
  onSearch(): void;
  onFit(selected: boolean): void;
  onHelp(): void;
  onSave(): void;
}

export const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  target.closest('input, textarea, select, [contenteditable], [role="dialog"]') !== null;

/** Board-wide keys; ignored while editing text or using the preset selector. */
export function useShortcuts(handlers: Handlers) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const formatKey = ({ b: 'bold', i: 'italic', u: 'underline' } as const)[
        key as 'b' | 'i' | 'u'
      ];
      if (isTyping(event.target)) {
        if (
          mod &&
          key === 's' &&
          event.target instanceof Element &&
          event.target.matches('.connection-label-input, .frame-title-input')
        ) {
          handlers.onSave();
          event.preventDefault();
          return;
        }
        if (mod && event.target instanceof HTMLElement && event.target.matches('.sticky-editor')) {
          if (formatKey) handlers.onFormat(formatKey);
          else if (key === 's') handlers.onSave();
          else return;
        } else return;
      } else if (mod && key === 'z') handlers[event.shiftKey ? 'onRedo' : 'onUndo']();
      else if (mod && key === 'y') handlers.onRedo();
      else if (mod && key === 'd') handlers.onDuplicate();
      else if (mod && key === 'a') handlers.onSelectAll();
      else if (mod && key === 'g') handlers.onGroup(event.shiftKey);
      else if (mod && event.shiftKey && key === 'l') handlers.onLock();
      else if (mod && formatKey) handlers.onFormat(formatKey);
      else if (mod && key === 'f') handlers.onSearch();
      else if (mod && key === 's') handlers.onSave();
      else if (event.altKey && (key === '1' || key === '2')) handlers.onFit(key === '2');
      else if (!mod && /^arrow/.test(key)) {
        const step = event.shiftKey ? 10 : 1;
        const offset = {
          x: key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0,
          y: key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0,
        };
        if (event.altKey)
          handlers.onDuplicate({ x: Math.sign(offset.x), y: Math.sign(offset.y) }, true);
        else handlers.onNudge(offset);
      } else if (!mod && (key === 'delete' || key === 'backspace')) handlers.onDelete();
      else if (!mod && key === 'escape') handlers.onEscape();
      else if (!mod && key === 'v') handlers.onTool('interact');
      else if (!mod && key === 'h') handlers.onTool('hand');
      else if (!mod && key === 'n') handlers.onTool('sticky');
      else if (!mod && key === 'l') handlers.onTool('connect');
      else if (!mod && key === 'f') handlers.onTool('frame');
      else if (key === 'f1' || key === '?') handlers.onHelp();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}
