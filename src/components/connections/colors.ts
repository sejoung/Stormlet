import type { ConnectionColor, ConnectionPath } from '../../domain/connections/model';

export const LINE_COLORS: Record<ConnectionColor, { color: string; label: string }> = {
  slate: { color: '#697389', label: '회색' },
  blue: { color: '#4262ff', label: '파란색' },
  red: { color: '#da5360', label: '빨간색' },
  green: { color: '#28936b', label: '초록색' },
  purple: { color: '#9560ce', label: '보라색' },
};

export const PATH_LABELS: Record<ConnectionPath, string> = {
  straight: '직선',
  elbow: '꺾인 선',
  curve: '곡선',
};
