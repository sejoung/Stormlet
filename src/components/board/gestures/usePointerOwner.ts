import { useEffect, useRef, type PointerEvent } from 'react';

/**
 * Binds the canvas's gestures to the pointer that started them. While one is in progress
 * (`busy`), a second finger neither starts another gesture (its press is stopped before it
 * reaches notes, frames or the background) nor moves or ends the first one. A mouse always
 * has the same pointer ID, so only multi-touch and pen-plus-touch are affected.
 */
export function usePointerOwner(busy: boolean) {
  const owner = useRef<number | null>(null);
  useEffect(() => {
    // Lifting the owning pointer anywhere releases ownership, even if the gesture was not
    // ended by the canvas (its captured element went away), so later touches still work.
    const release = (event: globalThis.PointerEvent) => {
      if (event.pointerId === owner.current) owner.current = null;
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, []);
  const foreign = (event: PointerEvent) =>
    busy && owner.current !== null && event.pointerId !== owner.current;
  return {
    /** For `onPointerDownCapture`: claims the gesture, or stops another pointer's press. */
    down(event: PointerEvent) {
      if (foreign(event)) {
        event.stopPropagation();
        return;
      }
      owner.current = event.pointerId;
    },
    /** Whether a move, release or lost capture belongs to the gesture in progress. */
    owns: (event: PointerEvent) => !foreign(event),
  };
}
