import { isKubernetesIcon, NOTE_ICONS, type NoteIcon } from '../../domain/note-details';
import type { MessageKey } from '../../i18n/messages';
import { useT } from '../common/i18n';
import { NoteIconGlyph } from './NoteIconGlyph';

/** The catalog name of each icon, for its button's label and tooltip. */
const label = (icon: NoteIcon) => `icon.${icon}` as MessageKey;

/** Pick the icon shown above the selected notes' text, or none (ADR 0018). */
export function NoteIconPicker({
  icons,
  onChange,
}: {
  icons: readonly (NoteIcon | null | undefined)[];
  onChange(icon: NoteIcon | null): void;
}) {
  const t = useT();
  const none = icons.every((icon) => !icon);
  const option = (icon: NoteIcon) => (
    <button
      key={icon}
      type="button"
      aria-label={t('selection.iconOption', { icon: t(label(icon)) })}
      title={t(label(icon))}
      aria-pressed={icons.every((value) => value === icon)}
      onClick={() => onChange(icon)}
    >
      <NoteIconGlyph icon={icon} size={20} />
    </button>
  );
  return (
    <>
      <span className="popover-label">{t('selection.iconGeneral')}</span>
      <div className="icon-grid">
        <button
          type="button"
          className="icon-none"
          aria-label={t('selection.iconNone')}
          title={t('selection.iconNone')}
          aria-pressed={none}
          onClick={() => onChange(null)}
        >
          ∅
        </button>
        {NOTE_ICONS.filter((icon) => !isKubernetesIcon(icon)).map(option)}
      </div>
      <span className="popover-label">{t('selection.iconKubernetes')}</span>
      <div className="icon-grid">{NOTE_ICONS.filter(isKubernetesIcon).map(option)}</div>
    </>
  );
}
