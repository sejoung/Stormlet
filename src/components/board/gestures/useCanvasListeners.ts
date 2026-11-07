import { useEffect, useState, type RefObject } from 'react';
import { wheelZoomFactor, zoomAround, type View } from '../../../engine/viewport';
import { TEXT_ENTRY } from '../../common/keyboard';
import { clientToLocal } from '../../common/points';
import { useLatest } from '../../common/useStableCallback';

/** Space-bar panning is off while focus is on a control that uses Space itself. */
const SPACE_OWNERS = `${TEXT_ENTRY}, button, [role="dialog"], [role="menu"]`;
/** Scrollable note text keeps the wheel while it still has content to scroll. */
const SCROLLABLE_TEXT = '.sticky-editor, .sticky-content';

interface Options {
  element: RefObject<HTMLDivElement | null>;
  view: View;
  onViewChange(view: View): void;
  /** Cancels every in-progress gesture: Escape, or the window losing focus. */
  onCancel(): void;
}

/**
 * Window and wheel listeners the canvas needs, each registered once and reading the latest
 * options through a ref. Returns whether Space is held for temporary panning.
 */
export function useCanvasListeners(options: Options): boolean {
  const [space, setSpace] = useState(false);
  const latest = useLatest(options);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') latest.current.onCancel();
      if (
        event.code === 'Space' &&
        !(event.target instanceof Element && event.target.closest(SPACE_OWNERS))
      ) {
        event.preventDefault();
        setSpace(true);
      }
    };
    const keyup = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpace(false);
    };
    const blur = () => {
      setSpace(false);
      latest.current.onCancel();
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', blur);
    };
  }, [latest]);

  const { element } = options;
  useEffect(() => {
    const node = element.current!;
    const onWheel = (event: WheelEvent) => {
      const content =
        event.target instanceof Element ? event.target.closest(SCROLLABLE_TEXT) : null;
      if (content && content.scrollHeight > content.clientHeight) return;
      event.preventDefault();
      const { view, onViewChange } = latest.current;
      onViewChange(
        zoomAround(view, view.zoom * wheelZoomFactor(event.deltaY), clientToLocal(node, event)),
      );
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [element, latest]);

  return space;
}
