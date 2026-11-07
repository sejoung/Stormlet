import type { FrameColor } from '../../domain/frames/model';

export const FRAME_STYLES: Record<FrameColor, { label: string; fill: string }> = {
  none: { label: '배경 없음', fill: 'transparent' },
  gray: { label: '회색', fill: '#b8beca' },
  blue: { label: '파란색', fill: '#7cb8ff' },
  green: { label: '초록색', fill: '#9ae6b4' },
  yellow: { label: '노란색', fill: '#fff3a3' },
  pink: { label: '분홍색', fill: '#ffb3d9' },
  purple: { label: '보라색', fill: '#d0b3ff' },
};
