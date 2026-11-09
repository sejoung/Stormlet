import { TEXT_COLORS, type TextColor } from '../../domain/text/model';
import { TEXT_STYLES } from './colors';
import { useT } from '../common/i18n';

export function TextColorPicker({
  colors,
  onChange,
}: {
  colors: readonly (TextColor | undefined)[];
  onChange(color: TextColor): void;
}) {
  const t = useT();
  return (
    <>
      <span className="popover-label">{t('text.color')}</span>
      <div className="color-grid">
        {TEXT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={t('text.colorOption', { color: t(TEXT_STYLES[color].label) })}
            aria-pressed={colors.every((value) => (value ?? 'default') === color)}
            style={{ background: TEXT_STYLES[color].color }}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
    </>
  );
}
