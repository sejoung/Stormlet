import type { PenStyle } from '../../domain/drawing/model';
import { useT } from '../common/i18n';
import { Icon } from '../toolbar/Icon';
import { PenControls } from './PenControls';

export function PenFlyout({
  style,
  onChange,
  onClose,
}: {
  style: PenStyle;
  onChange(style: Partial<PenStyle>): void;
  onClose(): void;
}) {
  const t = useT();
  return (
    <div
      className="creation-flyout flyout-pen"
      role="dialog"
      aria-modal="false"
      aria-label={t('pen.settings')}
    >
      <header>
        <h2>{t('pen.tool')}</h2>
        <button
          type="button"
          className="close-button"
          aria-label={t('creation.closeDefaults')}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      <PenControls style={style} onChange={onChange} />
      <p className="creation-flyout-hint">{t('pen.hint')}</p>
    </div>
  );
}
