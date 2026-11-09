import { Fragment } from 'react';
import type { Arrangement, SizeMatch } from '../../domain/note-actions';
import { HORIZONTAL_KEYS, moveFocus } from '../common/keyboard';
import { Icon } from '../toolbar/Icon';
import { useT } from '../common/i18n';
import { ARRANGEMENTS, SIZE_MATCHES, withShortcut } from './arrangements';

/**
 * One click away whenever several notes are selected: align, distribute, lay out in a grid
 * and match sizes, as icons whose tooltips give the name and shortcut.
 */
export function ArrangeToolbar({
  onArrange,
  onMatchSize,
}: {
  onArrange(action: Arrangement): void;
  onMatchSize(match: SizeMatch): void;
}) {
  const t = useT();
  const tool = (
    label: string,
    icon: Parameters<typeof Icon>[0]['name'],
    run: () => void,
    shortcut?: string,
  ) => (
    <button
      key={label}
      type="button"
      className="selection-tool"
      aria-label={label}
      title={withShortcut(label, shortcut)}
      onClick={run}
    >
      <Icon name={icon} />
    </button>
  );
  return (
    <div
      className="selection-toolbar arrange-toolbar"
      role="toolbar"
      aria-label={t('selection.arrangeHeading')}
      onKeyDown={(event) => {
        if (event.target instanceof HTMLButtonElement)
          moveFocus(event, event.currentTarget, 'button', HORIZONTAL_KEYS);
      }}
      onPointerDown={(event) => {
        // Keep the text cursor in an open editor, and keep the canvas from seeing the press.
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {ARRANGEMENTS.map((group, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="selection-divider" />}
          {group.map((item) =>
            tool(t(item.label), item.icon, () => onArrange(item.action), item.shortcut),
          )}
        </Fragment>
      ))}
      <span className="selection-divider" />
      {SIZE_MATCHES.map((item) =>
        tool(t(item.label), item.icon, () => onMatchSize(item.action), t('selection.matchHint')),
      )}
    </div>
  );
}
