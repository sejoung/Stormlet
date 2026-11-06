import {
  KIND_COLORS,
  STICKY_COLORS,
  STICKY_KINDS,
  type StickyAppearance,
  type StickyColor,
  type StickyKind,
} from '../../domain/model';

export type PaletteMode = 'free' | 'eventStorming';
export type BoardTool = 'select' | 'pan' | 'sticky';
export interface PaletteEntry extends StickyAppearance {
  label: string;
}

export const COLOR_STYLES: Record<StickyColor, { label: string; paper: string; ink: string }> = {
  yellow: { label: '노란색', paper: '#fff3a3', ink: '#2e2a07' },
  orange: { label: '주황색', paper: '#ffa64d', ink: '#2b1a07' },
  blue: { label: '파란색', paper: '#7cb8ff', ink: '#0b2140' },
  green: { label: '초록색', paper: '#9ae6b4', ink: '#0b2b17' },
  purple: { label: '보라색', paper: '#d0b3ff', ink: '#1f0f3d' },
  pink: { label: '분홍색', paper: '#ffb3d9', ink: '#3d0a24' },
  red: { label: '빨간색', paper: '#ff6b81', ink: '#3b0a15' },
  gold: { label: '진노란색', paper: '#ffd84d', ink: '#2e2405' },
};

export const KIND_LABELS: Record<StickyKind, string> = {
  event: '도메인 이벤트',
  command: '커맨드',
  actor: '액터',
  policy: '정책',
  aggregate: '애그리거트',
  readModel: '읽기 모델',
  externalSystem: '외부 시스템',
  hotspot: '핫스팟',
};

export const paletteEntries = (mode: PaletteMode): PaletteEntry[] =>
  mode === 'free'
    ? STICKY_COLORS.map((color) => ({
        color,
        kind: null,
        label: `${COLOR_STYLES[color].label} 포스트잇`,
      }))
    : STICKY_KINDS.map((kind) => ({ kind, color: KIND_COLORS[kind], label: KIND_LABELS[kind] }));
