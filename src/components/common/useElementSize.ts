import { useLayoutEffect, useState, type RefObject } from 'react';

export interface Size {
  width: number;
  height: number;
}

/** Assumed until the element is measured, so first-frame layout has something sensible. */
const UNMEASURED: Size = { width: 900, height: 700 };

/** `element`'s client size, kept current as it resizes. */
export function useElementSize(element: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState(UNMEASURED);
  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    const measure = () =>
      setSize((current) =>
        current.width === node.clientWidth && current.height === node.clientHeight
          ? current
          : { width: node.clientWidth, height: node.clientHeight },
      );
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [element]);
  return size;
}
