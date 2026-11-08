import type { FrameColor } from '../../domain/frames/model';
import type { MessageKey } from '../../i18n/messages';

export const FRAME_STYLES: Record<FrameColor, { label: MessageKey; fill: string }> = {
  none: { label: 'frameColor.none', fill: 'transparent' },
  gray: { label: 'frameColor.gray', fill: '#b8beca' },
  blue: { label: 'frameColor.blue', fill: '#7cb8ff' },
  green: { label: 'frameColor.green', fill: '#9ae6b4' },
  yellow: { label: 'frameColor.yellow', fill: '#fff3a3' },
  pink: { label: 'frameColor.pink', fill: '#ffb3d9' },
  purple: { label: 'frameColor.purple', fill: '#d0b3ff' },
};
