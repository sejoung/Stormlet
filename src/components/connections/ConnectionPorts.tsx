import type { PointerEvent } from 'react';
import type { ConnectionSide } from '../../domain/connections/model';
import { useT } from '../common/i18n';

const PORTS = [
  ['top', 'connection.portTop'],
  ['right', 'connection.portRight'],
  ['bottom', 'connection.portBottom'],
  ['left', 'connection.portLeft'],
] as const;

export function ConnectionPorts({
  onStart,
  onKeyboardStart,
}: {
  onStart(event: PointerEvent, side: ConnectionSide): void;
  onKeyboardStart(side: ConnectionSide): void;
}) {
  const t = useT();
  return (
    <>
      {PORTS.map(([side, label]) => (
        <button
          key={side}
          type="button"
          className={`connection-port port-${side}`}
          aria-label={t(label)}
          title={t('connection.portHint')}
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
