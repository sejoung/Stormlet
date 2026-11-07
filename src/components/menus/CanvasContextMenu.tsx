import type { Point } from '../../engine/viewport';
import { ContextMenu } from './ContextMenu';

export type MenuAction =
  | { label: string; run(): void; disabled?: boolean; shortcut?: string; destructive?: boolean }
  | { separator: true };
export interface CanvasTarget {
  frameId?: string;
  connectionId?: string;
}
export function canvasTarget(target: EventTarget): CanvasTarget {
  if (!(target instanceof Element)) return {};
  const frameId = target.closest('[data-frame-id]')?.getAttribute('data-frame-id') ?? undefined;
  const connectionId =
    target.closest('[data-connection-id]')?.getAttribute('data-connection-id') ?? undefined;
  return { frameId, connectionId };
}

export function CanvasContextMenu({
  point,
  actions,
  onClose,
}: {
  point: Point;
  actions: MenuAction[];
  onClose(): void;
}) {
  return (
    <ContextMenu point={point} label="캔버스 메뉴" onClose={onClose}>
      {actions.map((action, index) =>
        'separator' in action ? (
          <div key={index} className="context-separator" role="separator" />
        ) : (
          <button
            key={action.label}
            type="button"
            role="menuitem"
            disabled={action.disabled}
            className={action.destructive ? 'context-delete' : undefined}
            onClick={() => {
              action.run();
              onClose();
            }}
          >
            {action.label}
            {action.shortcut && <span>{action.shortcut}</span>}
          </button>
        ),
      )}
    </ContextMenu>
  );
}
