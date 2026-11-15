import { PEN_COLORS, PEN_WIDTHS, type PenStyle } from '../../domain/drawing/model';
import { useT } from '../common/i18n';

export function PenControls({
  style,
  onChange,
  disabled = false,
}: {
  style: PenStyle;
  onChange(style: Partial<PenStyle>): void;
  disabled?: boolean;
}) {
  const t = useT();
  return (
    <fieldset className="pen-controls" disabled={disabled}>
      <legend>{t('pen.style')}</legend>
      <div className="pen-colors" role="group" aria-label={t('pen.color')}>
        {PEN_COLORS.map((color, i) => (
          <button
            key={color}
            type="button"
            style={{ background: color }}
            aria-label={t('pen.colorOption', {
              color: t(
                (
                  [
                    'pen.black',
                    'pen.white',
                    'pen.red',
                    'pen.orange',
                    'pen.green',
                    'pen.blue',
                    'pen.purple',
                  ] as const
                )[i],
              ),
            })}
            aria-pressed={style.strokeColor.toLowerCase() === color}
            onClick={() => onChange({ strokeColor: color })}
          />
        ))}
        <input
          type="color"
          aria-label={t('pen.customColor')}
          value={style.strokeColor}
          onChange={(event) => onChange({ strokeColor: event.target.value })}
        />
      </div>
      <label className="pen-width">
        {t('pen.width')}
        <select
          aria-label={t('pen.width')}
          value={style.strokeWidth}
          onChange={(event) => onChange({ strokeWidth: Number(event.target.value) })}
        >
          {[...new Set([...PEN_WIDTHS, style.strokeWidth])]
            .sort((a, b) => a - b)
            .map((width) => (
              <option key={width} value={width}>
                {width}px
              </option>
            ))}
        </select>
        <svg width="64" height="24" aria-hidden="true">
          <path
            d="M 8 12 L 56 12"
            stroke={style.strokeColor}
            strokeWidth={style.strokeWidth}
            strokeLinecap="round"
          />
        </svg>
      </label>
    </fieldset>
  );
}
