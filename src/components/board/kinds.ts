import type { StickyColor, StickyKind } from '../../domain/model';

export type BoardTool = 'interact' | 'sticky' | 'hand';

export const COLOR_STYLES: Record<StickyColor, { label: string; paper: string; ink: string }> = {
  yellow: { label: '노란색', paper: '#fff3a3', ink: '#2e2a07' },
  orange: { label: '주황색', paper: '#ffa64d', ink: '#2b1a07' },
  blue: { label: '파란색', paper: '#7cb8ff', ink: '#0b2140' },
  green: { label: '초록색', paper: '#9ae6b4', ink: '#0b2b17' },
  purple: { label: '보라색', paper: '#d0b3ff', ink: '#1f0f3d' },
  pink: { label: '분홍색', paper: '#ffb3d9', ink: '#3d0a24' },
  red: { label: '빨간색', paper: '#ff6b81', ink: '#3b0a15' },
  gold: { label: '진노란색', paper: '#ffd84d', ink: '#2e2405' },
  lime: { label: '연두색', paper: '#d9ef9b', ink: '#263310' },
  teal: { label: '청록색', paper: '#9ee0d5', ink: '#123b36' },
  sky: { label: '하늘색', paper: '#c2e7fb', ink: '#173b50' },
  violet: { label: '연보라색', paper: '#e5d8fa', ink: '#38274e' },
  rose: { label: '장미색', paper: '#f4c8ce', ink: '#4a252e' },
  peach: { label: '살구색', paper: '#ffdcc5', ink: '#52321f' },
  gray: { label: '회색', paper: '#dce0e5', ink: '#303742' },
  white: { label: '흰색', paper: '#fffef8', ink: '#303039' },
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
