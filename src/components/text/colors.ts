import type { TextColor } from '../../domain/text/model';
import type { MessageKey } from '../../i18n/messages';

export const TEXT_STYLES: Record<TextColor, { color: string; label: MessageKey }> = {
  default: { color: 'var(--text)', label: 'text.colorDefault' },
  black: { color: '#232436', label: 'text.colorBlack' },
  gray: { color: '#737485', label: 'text.colorGray' },
  red: { color: '#d43650', label: 'text.colorRed' },
  orange: { color: '#bd5b10', label: 'text.colorOrange' },
  green: { color: '#23834d', label: 'text.colorGreen' },
  blue: { color: '#4262e8', label: 'text.colorBlue' },
  purple: { color: '#8a4bc4', label: 'text.colorPurple' },
};

export const textInk = (color: TextColor = 'default'): string => TEXT_STYLES[color].color;
