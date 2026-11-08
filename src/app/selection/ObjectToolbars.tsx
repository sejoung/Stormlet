import type { Board } from '../../domain/model';
import type { View } from '../../engine/viewport';
import type { FrameInteraction } from '../../components/frames/types';
import { FrameToolbar } from '../../components/frames/FrameToolbar';
import { ConnectionToolbar } from '../../components/connections/ConnectionToolbar';
import type { Size } from '../../components/common/useElementSize';
import type { ConnectionSession } from '../useConnectionSession';

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
  viewport: Size;
  frames: FrameInteraction;
  links: Pick<ConnectionSession, 'selected' | 'editingLabel' | 'onChange' | 'remove'>;
  onDeleteFrame(): void;
  hidden?: boolean;
}) {
  if (hidden) return null;
  const line = links.selected;
  return (
    <>
      {frames.selected && (
        <FrameToolbar frames={frames} view={view} viewport={viewport} onDelete={onDeleteFrame} />
      )}
      {line && (
        <ConnectionToolbar
          key={line.id}
          board={board}
          line={line}
          viewport={viewport}
          view={view}
          editingLabel={links.editingLabel}
          onChange={(values) => links.onChange(line.id, values)}
          onDelete={links.remove}
        />
      )}
    </>
  );
}
