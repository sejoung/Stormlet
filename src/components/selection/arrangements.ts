import type { Arrangement, SizeMatch } from '../../domain/note-actions';
import type { MessageKey } from '../../i18n/messages';

/** Arrange actions with their labels and keyboard shortcuts, for the toolbar and the menu. */
export const ARRANGEMENTS: readonly [Arrangement, MessageKey, shortcut?: string][] = [
  ['left', 'selection.arrangeLeft', 'Alt+A'],
  ['center', 'selection.arrangeCenter', 'Alt+H'],
  ['right', 'selection.arrangeRight', 'Alt+D'],
  ['top', 'selection.arrangeTop', 'Alt+W'],
  ['middle', 'selection.arrangeMiddle', 'Alt+V'],
  ['bottom', 'selection.arrangeBottom', 'Alt+S'],
  ['horizontal', 'selection.arrangeHorizontal', 'Alt+Shift+H'],
  ['vertical', 'selection.arrangeVertical', 'Alt+Shift+V'],
  ['grid', 'selection.arrangeGrid'],
];

export const SIZE_MATCHES: readonly [SizeMatch, MessageKey][] = [
  ['width', 'selection.matchWidth'],
  ['height', 'selection.matchHeight'],
  ['size', 'selection.matchSize'],
];
