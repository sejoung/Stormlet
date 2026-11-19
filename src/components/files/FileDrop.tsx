import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../common/i18n';
import { useLatest } from '../common/useStableCallback';
import { Icon } from '../toolbar/Icon';

/** Whether a drag carries files from the desktop, rather than text or a link. */
const carriesFiles = (event: DragEvent) => !!event.dataTransfer?.types.includes('Files');

/**
 * Open a board file dropped anywhere on the page, as File → Open would (ADR 0017). Only
 * drags that carry files show the hint or are taken, so moving notes, the swatch drag and
 * dragging text into an editor behave as before. The browser never navigates to the file.
 */
export function FileDrop({ onOpen }: { onOpen(file: File): void }) {
  const t = useT();
  const [over, setOver] = useState(false);
  // dragenter and dragleave fire for every element crossed; count them to know when it left.
  const depth = useRef(0);
  const open = useLatest(onOpen);

  useEffect(() => {
    const enter = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth.current++;
      setOver(true);
    };
    const hover = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const leave = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setOver(false);
    };
    const drop = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth.current = 0;
      setOver(false);
      const file = event.dataTransfer?.files[0];
      if (file) open.current(file);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', hover);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', hover);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [open]);

  if (!over) return null;
  return createPortal(
    <div className="file-drop" aria-hidden="true">
      <div className="file-drop-hint">
        <Icon name="open" size={20} />
        <span>{t('files.dropHint')}</span>
      </div>
    </div>,
    document.body,
  );
}
