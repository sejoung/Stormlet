import type { PointerEvent } from 'react';
import type { ConnectionSide } from '../../domain/connections/model';

const PORTS = [
  ['top', '위'],
  ['right', '오른쪽'],
  ['bottom', '아래'],
  ['left', '왼쪽'],
] as const;

export function ConnectionPorts({
  onStart,
  onKeyboardStart,
}: {
  onStart(event: PointerEvent, side: ConnectionSide): void;
  onKeyboardStart(side: ConnectionSide): void;
}) {
  return (
    <>
      {PORTS.map(([side, label]) => (
        <button
          key={side}
          type="button"
          className={`connection-port port-${side}`}
          aria-label={`${label} 연결점`}
          title="드래그하거나 클릭한 뒤 다른 메모를 눌러 연결"
          onPointerDown={(event) => onStart(event, side)}
          onDoubleClick={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            if (!event.detail) onKeyboardStart(side);
          }}
        />
      ))}
    </>
  );
}
