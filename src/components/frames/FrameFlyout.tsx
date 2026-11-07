import type { FrameInteraction } from './types';
import { Icon } from '../toolbar/Icon';

const PRESETS = [
  { label: '자유 크기', width: 640, height: 400 },
  { label: '가로 레인', width: 1200, height: 280 },
  { label: '세로 레인', width: 320, height: 1000 },
];

export function FrameFlyout({ frames, onClose }: { frames: FrameInteraction; onClose(): void }) {
  return (
    <section className="creation-flyout flyout-frame" role="dialog" aria-label="프레임 기본 설정">
      <header>
        <h2>프레임</h2>
        <button
          type="button"
          className="close-button"
          aria-label="기본 설정 닫기"
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
            {preset.label}
          </button>
        ))}
      </div>
      <p className="creation-flyout-hint">드래그로 영역 지정 · 클릭으로 기본 크기 추가</p>
    </section>
  );
}
