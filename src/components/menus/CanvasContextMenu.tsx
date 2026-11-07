import type { Point } from '../../engine/viewport';
import { ContextMenu } from './ContextMenu';

export type MenuAction =
  | { label: string; run(): void; disabled?: boolean; shortcut?: string; destructive?: boolean }
  | { separator: true };
export interface CanvasTarget {
  frameId?: string;
  connectionId?: string;
}
/** The value of `attribute` on `target` or its nearest ancestor that has it. */
export const closestData = (target: EventTarget, attribute: string): string | undefined =>
  target instanceof Element
    ? (target.closest(`[${attribute}]`)?.getAttribute(attribute) ?? undefined)
    : undefined;

export const canvasTarget = (target: EventTarget): CanvasTarget => ({
  frameId: closestData(target, 'data-frame-id'),
  connectionId: closestData(target, 'data-connection-id'),
});

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
