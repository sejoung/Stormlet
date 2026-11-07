import { useState, type ReactNode } from 'react';
import { STICKY_COLORS, type Sticky } from '../../domain/model';
import {
  DEFAULT_NOTE_FONT,
  REACTION_EMOJI,
  TEXT_ALIGNS,
  type NoteDetails,
  type TextAlign,
} from '../../domain/note-details';
import { boundsOf } from '../../domain/geometry/bounds';
import { HORIZONTAL_KEYS, moveFocus } from '../common/keyboard';
import { useLargestFit } from '../common/fitted-fonts';
import type { Arrangement } from '../../domain/note-actions';
import type { Point, View } from '../../engine/viewport';
import { COLOR_STYLES } from '../board/kinds';
import { Icon } from '../toolbar/Icon';

interface Props {
  notes: Sticky[];
  view: View;
  viewport: { width: number; height: number };
  onFormat(details: NoteDetails): void;
  onColor(color: Sticky['color']): void;
  onResize(size: { width: number; height: number }): void;
  onArrange(action: Arrangement): void;
  onDuplicate(): void;
  onGroup(): void;
  onFrame(): void;
  onReact(emoji: string): void;
  onMore(point: Point): void;
}

function Tool({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="selection-tool"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const ARRANGEMENTS: [Arrangement, string][] = [
  ['left', '왼쪽 맞춤'],
  ['center', '가로 가운데 맞춤'],
  ['right', '오른쪽 맞춤'],
  ['top', '위쪽 맞춤'],
  ['middle', '세로 가운데 맞춤'],
  ['bottom', '아래쪽 맞춤'],
  ['horizontal', '가로 간격 맞춤'],
  ['vertical', '세로 간격 맞춤'],
  ['grid', '격자로 정리'],
];

const ALIGN_LABELS: Record<TextAlign, string> = { left: '왼쪽', center: '가운데', right: '오른쪽' };
const FONT_SIZES = [8, 10, 12, 14, 16, 18, 24, 32, 48, 64];
/** Rectangle notes keep their width and take this share of it as height. */
const RECTANGLE_RATIO = 0.75;
/** Toolbar footprint and gaps used to keep it on screen above or below the selection. */
const PANEL = { width: 660, height: 300, margin: 12, above: 60, below: 16, minTop: 64 };

/** Screen-space controls stay readable at every board zoom level. */
export function SelectionToolbar(props: Props) {
  const [panel, setPanel] = useState<'color' | 'align' | 'emoji' | null>(null);
  const note = props.notes[0];
  const locked = props.notes.some((s) => s.locked);
  const grouped = props.notes.some((s) => s.groupId);
  const bounds = boundsOf(props.notes)!;
  const { zoom, x, y } = props.view;
  const left = bounds.left * zoom + x;
  const top = bounds.top * zoom + y;
  const bottom = bounds.bottom * zoom + y;
  // Sizes the text would overflow at are disabled, so a chosen size never makes a note scroll.
  const largestFit = useLargestFit(props.notes.map((s) => s.id));
  // A chosen size the text has outgrown shows at the largest size that fits; list that size.
  const noteFit = useLargestFit([note.id]);
  const shownSize =
    note.autoFont === false ? Math.min(note.fontSize ?? DEFAULT_NOTE_FONT, noteFit) : null;
  const fontSizes = [...new Set([...FONT_SIZES, ...(shownSize === null ? [] : [shownSize])])].sort(
    (a, b) => a - b,
  );
  const toggle = (next: typeof panel) => setPanel(panel === next ? null : next);
  return (
    <div
      className="selection-anchor"
      style={{
        left: Math.max(PANEL.margin, Math.min(left, props.viewport.width - PANEL.width)),
        top: Math.max(
          PANEL.margin,
          Math.min(
            top >= PANEL.minTop ? top - PANEL.above : bottom + PANEL.below,
            props.viewport.height - PANEL.height,
          ),
        ),
      }}
    >
      <div
        className="selection-toolbar"
        role="toolbar"
        aria-label="포스트잇 편집 도구"
        onKeyDown={(event) => {
          if (event.target instanceof HTMLButtonElement)
            moveFocus(event, event.currentTarget, 'button:not(:disabled)', HORIZONTAL_KEYS);
        }}
        onPointerDown={(event) => {
          // Keep the text cursor when clicking formatting buttons.
          if ((event.target as HTMLElement).closest('button')) event.preventDefault();
          event.stopPropagation();
        }}
      >
        <span className="selection-count">
          {props.notes.length > 1 ? `${props.notes.length}개 선택` : '포스트잇'}
        </span>
        <Tool
          label="포스트잇 색 변경"
          disabled={locked}
          active={panel === 'color'}
          onClick={() => toggle('color')}
        >
          <span className="color-preview" style={{ background: COLOR_STYLES[note.color].paper }} />
        </Tool>
        <span className="selection-divider" />
        <Tool
          label="굵게"
          active={!!note.bold}
          disabled={locked}
          onClick={() => props.onFormat({ bold: !note.bold })}
        >
          <b>B</b>
        </Tool>
        <Tool
          label="기울임"
          active={!!note.italic}
          disabled={locked}
          onClick={() => props.onFormat({ italic: !note.italic })}
        >
          <i>I</i>
        </Tool>
        <Tool
          label="밑줄"
          active={!!note.underline}
          disabled={locked}
          onClick={() => props.onFormat({ underline: !note.underline })}
        >
          <u>U</u>
        </Tool>
        <select
          aria-label="글자 크기"
          disabled={locked}
          value={shownSize === null ? 'auto' : String(shownSize)}
          onChange={(event) =>
            props.onFormat(
              event.target.value === 'auto'
                ? { autoFont: true }
                : { autoFont: false, fontSize: Number(event.target.value) },
            )
          }
        >
          <option value="auto">자동</option>
          {fontSizes.map((size) => (
            <option key={size} value={size} disabled={size > largestFit}>
              {size}
            </option>
          ))}
        </select>
        <Tool
          label="정렬과 배치"
          active={panel === 'align'}
          disabled={locked}
          onClick={() => toggle('align')}
        >
          <Icon name="align" />
        </Tool>
        <Tool label="반응 추가" active={panel === 'emoji'} onClick={() => toggle('emoji')}>
          <Icon name="emoji" />
        </Tool>
        <span className="selection-divider" />
        <Tool label="포스트잇 복제" onClick={props.onDuplicate}>
          <Icon name="duplicate" />
        </Tool>
        <Tool label="프레임 만들기" onClick={props.onFrame}>
          <Icon name="frame" />
        </Tool>
        {props.notes.length > 1 && (
          <Tool
            label={grouped ? '그룹 해제' : '그룹으로 묶기'}
            disabled={locked}
            onClick={props.onGroup}
          >
            <Icon name="group" />
          </Tool>
        )}
        <Tool
          label={locked ? '잠금 해제' : '포스트잇 잠금'}
          active={locked}
          onClick={() => props.onFormat({ locked: !locked })}
        >
          <Icon name={locked ? 'lock' : 'unlock'} />
        </Tool>
        <Tool label="더 보기" onClick={() => props.onMore({ x: left, y: top })}>
          <Icon name="more" />
        </Tool>
      </div>
      {panel && (!locked || panel === 'emoji') && (
        <div className={`selection-popover panel-${panel}`}>
          {panel === 'color' && (
            <>
              <span className="popover-label">색상</span>
              <div className="color-grid">
                {STICKY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`${COLOR_STYLES[color].label}으로 변경`}
                    aria-pressed={props.notes.every((s) => s.color === color)}
                    style={{ background: COLOR_STYLES[color].paper }}
                    onClick={() => {
                      props.onColor(color);
                      setPanel(null);
                    }}
                  />
                ))}
              </div>
              <span className="popover-label">모양</span>
              <div className="shape-options">
                <button
                  type="button"
                  onClick={() => props.onResize({ width: note.width, height: note.width })}
                >
                  □ 정사각형
                </button>
                <button
                  type="button"
                  onClick={() =>
                    props.onResize({
                      width: note.width,
                      height: Math.round(note.width * RECTANGLE_RATIO),
                    })
                  }
                >
                  ▭ 직사각형
                </button>
              </div>
            </>
          )}
          {panel === 'align' && (
            <>
              <span className="popover-label">텍스트 정렬</span>
              <div className="shape-options">
                {TEXT_ALIGNS.map((align) => (
                  <button
                    key={align}
                    type="button"
                    aria-pressed={(note.textAlign ?? 'center') === align}
                    onClick={() => props.onFormat({ textAlign: align })}
                  >
                    {ALIGN_LABELS[align]}
                  </button>
                ))}
              </div>
              {props.notes.length > 1 && (
                <>
                  <span className="popover-label">배치</span>
                  <div className="arrange-options">
                    {ARRANGEMENTS.map(([action, label]) => (
                      <button key={action} type="button" onClick={() => props.onArrange(action)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          {panel === 'emoji' && (
            <>
              <span className="popover-label">반응</span>
              <div className="emoji-options">
                {REACTION_EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={`${emoji} 반응`}
                    onClick={() => props.onReact(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
