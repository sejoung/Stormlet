import type { StickyColor, StickyKind } from '../../domain/model';
import type { MessageKey } from '../../i18n/messages';

export type BoardTool = 'interact' | 'sticky' | 'text' | 'hand' | 'connect' | 'frame';

export const COLOR_STYLES: Record<StickyColor, { label: MessageKey; paper: string; ink: string }> =
  {
    yellow: { label: 'noteColor.yellow', paper: '#fff3a3', ink: '#2e2a07' },
    orange: { label: 'noteColor.orange', paper: '#ffa64d', ink: '#2b1a07' },
    blue: { label: 'noteColor.blue', paper: '#7cb8ff', ink: '#0b2140' },
    green: { label: 'noteColor.green', paper: '#9ae6b4', ink: '#0b2b17' },
    purple: { label: 'noteColor.purple', paper: '#d0b3ff', ink: '#1f0f3d' },
    pink: { label: 'noteColor.pink', paper: '#ffb3d9', ink: '#3d0a24' },
    red: { label: 'noteColor.red', paper: '#ff6b81', ink: '#3b0a15' },
    gold: { label: 'noteColor.gold', paper: '#ffd84d', ink: '#2e2405' },
    lime: { label: 'noteColor.lime', paper: '#d9ef9b', ink: '#263310' },
    teal: { label: 'noteColor.teal', paper: '#9ee0d5', ink: '#123b36' },
    sky: { label: 'noteColor.sky', paper: '#c2e7fb', ink: '#173b50' },
    violet: { label: 'noteColor.violet', paper: '#e5d8fa', ink: '#38274e' },
    rose: { label: 'noteColor.rose', paper: '#f4c8ce', ink: '#4a252e' },
    peach: { label: 'noteColor.peach', paper: '#ffdcc5', ink: '#52321f' },
    gray: { label: 'noteColor.gray', paper: '#dce0e5', ink: '#303742' },
    white: { label: 'noteColor.white', paper: '#fffef8', ink: '#303039' },
  };

export const KIND_LABELS: Record<StickyKind, MessageKey> = {
  event: 'note.kindEvent',
  command: 'note.kindCommand',
  actor: 'note.kindActor',
  policy: 'note.kindPolicy',
  aggregate: 'note.kindAggregate',
  readModel: 'note.kindReadModel',
  externalSystem: 'note.kindExternalSystem',
  hotspot: 'note.kindHotspot',
};
