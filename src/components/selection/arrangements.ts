import type { Arrangement, SizeMatch } from '../../domain/note-actions';
import type { MessageKey } from '../../i18n/messages';
import type { IconName } from '../toolbar/Icon';

/**
 * Arrange and match-size commands with their label, icon and shortcut. The selection
 * toolbar shows them as icons, the note menu and the Arrange menu as icon and text.
 */
export interface ArrangeCommand<T> {
  action: T;
  label: MessageKey;
  icon: IconName;
  shortcut?: string;
}

/** Aligning, then distributing, then laying out: the groups the toolbar separates. */
export const ARRANGEMENTS: readonly ArrangeCommand<Arrangement>[][] = [
  [
    {
      action: 'left',
      label: 'selection.arrangeLeft',
      icon: 'alignLeft',
      shortcut: 'Alt / Option+A',
    },
    {
      action: 'center',
      label: 'selection.arrangeCenter',
      icon: 'alignCenter',
      shortcut: 'Alt / Option+H',
    },
    {
      action: 'right',
      label: 'selection.arrangeRight',
      icon: 'alignRight',
      shortcut: 'Alt / Option+D',
    },
  ],
  [
    { action: 'top', label: 'selection.arrangeTop', icon: 'alignTop', shortcut: 'Alt / Option+W' },
    {
      action: 'middle',
      label: 'selection.arrangeMiddle',
      icon: 'alignMiddle',
      shortcut: 'Alt / Option+V',
    },
    {
      action: 'bottom',
      label: 'selection.arrangeBottom',
      icon: 'alignBottom',
      shortcut: 'Alt / Option+S',
    },
  ],
  [
    {
      action: 'horizontal',
      label: 'selection.arrangeHorizontal',
      icon: 'distributeHorizontal',
      shortcut: 'Alt / Option+Shift+H',
    },
    {
      action: 'vertical',
      label: 'selection.arrangeVertical',
      icon: 'distributeVertical',
      shortcut: 'Alt / Option+Shift+V',
    },
    { action: 'grid', label: 'selection.arrangeGrid', icon: 'arrangeGrid' },
  ],
];

export const SIZE_MATCHES: readonly ArrangeCommand<SizeMatch>[] = [
  { action: 'width', label: 'selection.matchWidth', icon: 'matchWidth' },
  { action: 'height', label: 'selection.matchHeight', icon: 'matchHeight' },
  { action: 'size', label: 'selection.matchSize', icon: 'matchSize' },
];

/** "Label (shortcut)", for tooltips. */
export const withShortcut = (label: string, shortcut?: string) =>
  shortcut ? `${label} (${shortcut})` : label;
