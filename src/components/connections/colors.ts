import type { ConnectionColor, ConnectionPath } from '../../domain/connections/model';
import type { MessageKey } from '../../i18n/messages';

export const LINE_COLORS: Record<ConnectionColor, { color: string; label: MessageKey }> = {
  slate: { color: '#697389', label: 'lineColor.slate' },
  blue: { color: '#4262ff', label: 'lineColor.blue' },
  red: { color: '#da5360', label: 'lineColor.red' },
  green: { color: '#28936b', label: 'lineColor.green' },
  purple: { color: '#9560ce', label: 'lineColor.purple' },
};

export const PATH_LABELS: Record<ConnectionPath, MessageKey> = {
  straight: 'linePath.straight',
  elbow: 'linePath.elbow',
  curve: 'linePath.curve',
};
