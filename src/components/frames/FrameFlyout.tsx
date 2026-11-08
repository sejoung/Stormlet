import type { FrameInteraction } from './types';
import { Icon } from '../toolbar/Icon';
import { DEFAULT_FRAME_SIZE } from '../../domain/frames/model';
import { useT } from '../common/i18n';
import type { MessageKey } from '../../i18n/messages';

const PRESETS: readonly { label: MessageKey; width: number; height: number }[] = [
  { label: 'frame.presetFree', ...DEFAULT_FRAME_SIZE },
  { label: 'frame.presetWide', width: 1200, height: 280 },
  { label: 'frame.presetTall', width: 320, height: 1000 },
];

export function FrameFlyout({ frames, onClose }: { frames: FrameInteraction; onClose(): void }) {
  const t = useT();
  return (
    <section
      className="creation-flyout flyout-frame"
      role="dialog"
      aria-label={t('frame.defaults')}
    >
      <header>
        <h2>{t('frame.heading')}</h2>
        <button
          type="button"
          className="close-button"
          aria-label={t('creation.closeDefaults')}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="frame-presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            aria-pressed={
              frames.size.width === preset.width && frames.size.height === preset.height
            }
            onClick={() => frames.onPreset({ width: preset.width, height: preset.height })}
          >
            <span
              className={`frame-preset-shape ${preset.width > preset.height * 2 ? 'is-wide' : preset.height > preset.width ? 'is-tall' : ''}`}
            />
            {t(preset.label)}
          </button>
        ))}
      </div>
      <p className="creation-flyout-hint">{t('frame.flyoutHint')}</p>
    </section>
  );
}
