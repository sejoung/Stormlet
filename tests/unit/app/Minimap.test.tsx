// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../src/app/App';
import { MINIMAP_KEY } from '../../../src/adapters/storage/preferences';
import { MINIMAP_SIZE } from '../../../src/components/minimap/Minimap';
import { memoryStore, ids, boardBounds } from '../../support/app';
import { boardOf, sticky } from '../../support/boards';

const toggle = () => screen.getByRole('button', { name: '미니맵' });
const minimap = () => screen.getByRole('application', { name: /미니맵/ });

/** The pan the board layer is drawn at. */
function pan() {
  const layer = document.querySelector<HTMLElement>('.board-layer')!;
  const [, x, y] = layer.style.transform.match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\)/)!;
  return { x: Number(x), y: Number(y) };
}

/** The minimap laid out at its own size at the page origin, with its shown board area. */
function placedMinimap() {
  const map = minimap();
  vi.spyOn(map, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, MINIMAP_SIZE.width, MINIMAP_SIZE.height),
  );
  const [x, y, width] = map.getAttribute('viewBox')!.split(' ').map(Number);
  const scale = width / MINIMAP_SIZE.width;
  /** Minimap pixels of a board point. */
  const at = (point: { x: number; y: number }) => ({
    clientX: (point.x - x) / scale,
    clientY: (point.y - y) / scale,
  });
  return { map, scale, at };
}

const renderApp = (initial = boardOf(sticky('a'), sticky('b', { x: 2000, y: 1200 }))) => {
  const store = memoryStore(initial);
  render(<App store={store} newId={ids()} />);
  // jsdom lays nothing out; give the canvas a 900 × 700 client size and let it remeasure.
  const canvas = boardBounds();
  Object.defineProperties(canvas, { clientWidth: { value: 900 }, clientHeight: { value: 700 } });
  fireEvent(window, new Event('resize'));
  return store;
};

describe('minimap', () => {
  afterEach(() => localStorage.clear());

  it('opens from the zoom controls and stays open after a reload', () => {
    renderApp();
    expect(screen.queryByRole('application', { name: /미니맵/ })).toBeNull();
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    expect(minimap()).toBeInTheDocument();
    expect(localStorage.getItem(MINIMAP_KEY)).toBe('open');
    expect(minimap().querySelectorAll('rect[fill]')).toHaveLength(2);

    cleanup();
    renderApp();
    expect(minimap()).toBeInTheDocument();
    fireEvent.click(toggle());
    expect(screen.queryByRole('application', { name: /미니맵/ })).toBeNull();
    expect(localStorage.getItem(MINIMAP_KEY)).toBe('closed');
  });

  it('centers the view where the map is clicked', () => {
    renderApp();
    fireEvent.click(toggle());
    const { map, at } = placedMinimap();
    fireEvent.pointerDown(map, { button: 0, ...at({ x: 2080, y: 1280 }) });
    fireEvent.pointerUp(map);
    // The 900 × 700 viewport now has the far note's center in its middle.
    expect(pan().x).toBeCloseTo(450 - 2080);
    expect(pan().y).toBeCloseTo(350 - 1280);
  });

  it('drags the viewport outline without jumping, on a map that holds still', () => {
    // With one small note, dragging the outline away would otherwise grow the map under it.
    renderApp(boardOf(sticky('a')));
    fireEvent.click(toggle());
    const { map, scale, at } = placedMinimap();
    const viewBox = map.getAttribute('viewBox');
    const grab = at({ x: 100, y: 100 });
    fireEvent.pointerDown(map, { button: 0, ...grab });
    expect(pan()).toEqual({ x: 0, y: 0 });
    fireEvent.pointerMove(map, { clientX: grab.clientX + 20, clientY: grab.clientY + 10 });
    expect(pan().x).toBeCloseTo(-20 * scale);
    expect(pan().y).toBeCloseTo(-10 * scale);
    expect(map.getAttribute('viewBox')).toBe(viewBox);
    fireEvent.pointerUp(map);
  });

  it('pans with arrow keys without moving the selected note', () => {
    const store = renderApp();
    const note = screen.getByRole('button', { name: '도메인 이벤트: a' });
    fireEvent.pointerDown(note, { button: 0 });
    fireEvent.pointerUp(note);
    expect(note).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle());
    minimap().focus();
    fireEvent.keyDown(minimap(), { key: 'ArrowRight' });
    fireEvent.keyDown(minimap(), { key: 'ArrowDown' });
    expect(pan()).toEqual({ x: -900 / 4, y: -700 / 4 });
    expect(store.board.stickies.a).toMatchObject({ x: 0, y: 0 });
  });
});
