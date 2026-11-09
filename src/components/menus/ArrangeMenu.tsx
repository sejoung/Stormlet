import { Fragment } from 'react';
import type { Arrangement, SizeMatch } from '../../domain/note-actions';
import { ARRANGEMENTS, SIZE_MATCHES } from '../selection/arrangements';
import { MenuButton, MenuItem, MenuSection } from './MenuButton';
import { useT } from '../common/i18n';

export interface ArrangeCommands {
  /** How many notes are selected; arranging needs at least two. */
  notes: number;
  onArrange(action: Arrangement): void;
  onMatchSize(match: SizeMatch): void;
}

/** Aligning, distributing and matching sizes of the selected notes, with their shortcuts. */
export function ArrangeMenu({ commands: c }: { commands: ArrangeCommands }) {
  const t = useT();
  const disabled = c.notes < 2;
  return (
    <MenuButton label={t('menu.arrange')} icon="alignLeft">
      {(close) => (
        <>
          {ARRANGEMENTS.map((group, index) => (
            <Fragment key={index}>
              {index > 0 && <MenuSection />}
              {group.map((item) => (
                <MenuItem
                  key={item.action}
                  label={t(item.label)}
                  icon={item.icon}
                  shortcut={item.shortcut}
                  disabled={disabled}
                  close={close}
                  onSelect={() => c.onArrange(item.action)}
                />
              ))}
            </Fragment>
          ))}
          <MenuSection heading={t('selection.matchHeading')} />
          {SIZE_MATCHES.map((item) => (
            <MenuItem
              key={item.action}
              label={t(item.label)}
              icon={item.icon}
              title={t('selection.matchHint')}
              disabled={disabled}
              close={close}
              onSelect={() => c.onMatchSize(item.action)}
            />
          ))}
        </>
      )}
    </MenuButton>
  );
}
