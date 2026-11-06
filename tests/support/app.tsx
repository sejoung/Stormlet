import { fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { emptyBoard, type Board } from '../../src/domain/model';
import { applyPatches, type Patch } from '../../src/domain/patch';
import type { BoardStore } from '../../src/domain/store';

/** An in-memory store that records what the app hands it and can push outside changes. */
export function memoryStore(board: Board = emptyBoard()) {
  let listener: ((patches: Patch[]) => void) | null = null;
  const store: BoardStore & { board: Board; push(patches: Patch[]): void } = {
    board,
    load: () => store.board,
    apply: (patches) => {
      store.board = applyPatches(store.board, patches).board;
    },
    subscribe: (next) => {
      listener = next;
      return () => (listener = null);
    },
    push: (patches) => listener?.(patches),
  };
  return store;
}

// jsdom lacks pointer capture and PointerEvent; mouse events carry the same fields here.
Element.prototype.setPointerCapture ??= () => {};
window.PointerEvent ??= class extends MouseEvent {} as typeof PointerEvent;

export const ids = () => {
  let n = 0;
  return () => `s${++n}`;
};

export const boardBounds = () => {
  const board = screen.getByRole('application', { name: '포스트잇 보드' });
  vi.spyOn(board, 'getBoundingClientRect').mockReturnValue(new DOMRect(200, 80, 1000, 700));
  return board;
};

export const startDrag = (name: string, x = 800, y = 400) => {
  const swatch = screen.getByRole('button', { name });
  fireEvent.pointerDown(swatch, { button: 0, pointerId: 1, clientX: 80, clientY: 180 });
  fireEvent.pointerMove(swatch, { pointerId: 1, clientX: x, clientY: y });
  return swatch;
};

export const drop = (swatch: HTMLElement, x = 800, y = 400) => {
  fireEvent.pointerUp(swatch, { pointerId: 1, clientX: x, clientY: y });
  // Captured pointer sequences produce a click on the original palette button in browsers.
  fireEvent.click(swatch);
};
