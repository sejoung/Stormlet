import type { Board } from '../domain/model';
import type { View } from '../engine/viewport';
import type { FrameInteraction } from '../components/frames/types';
import { FrameToolbar } from '../components/frames/FrameToolbar';
import { ConnectionToolbar } from '../components/connections/ConnectionToolbar';
import type { useConnectionSession } from './useConnectionSession';

export function ObjectToolbars({
  board,
  view,
  viewport,
  frames,
  links,
  onDeleteFrame,
  hidden,
}: {
  board: Board;
  view: View;
  viewport: { width: number; height: number };
  frames: FrameInteraction;
  links: ReturnType<typeof useConnectionSession>;
  onDeleteFrame(): void;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <>
      {frames.selected && (
        <FrameToolbar frames={frames} view={view} viewport={viewport} onDelete={onDeleteFrame} />
      )}
      {links.selected && (
        <ConnectionToolbar
          key={links.selected.id}
          board={board}
          line={links.selected}
          view={view}
          editingLabel={links.editingLabel}
          onChange={(values) => links.onChange(links.selected!.id, values)}
          onDelete={links.remove}
        />
      )}
    </>
  );
}
