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
import type { Arrangement, SizeMatch } from '../../domain/note-actions';
import type { Point, View } from '../../engine/viewport';
import { COLOR_STYLES } from '../board/kinds';
import { ArrangeToolbar } from './ArrangeToolbar';
import { Icon } from '../toolbar/Icon';
import { useT } from '../common/i18n';
import { isText } from '../../domain/text/model';
import { TextColorPicker } from '../text/TextColorPicker';
import { textInk } from '../text/colors';
import type { MessageKey } from '../../i18n/messages';

interface Props {
  notes: readonly Sticky[];
  view: View;
  viewport: { width: number; height: number };
  onFormat(details: NoteDetails): void;
  onColor(color: Sticky['color']): void;
  onResize(size: { width: number; height: number }): void;
  onArrange(action: Arrangement): void;
  onMatchSize(match: SizeMatch): void;
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

const ALIGN_LABELS: Record<TextAlign, MessageKey> = {
  left: 'selection.alignLeft',
  center: 'selection.alignCenter',
  right: 'selection.alignRight',
};
const FONT_SIZES = [8, 10, 12, 14, 16, 18, 24, 32, 48, 64];
/** Rectangle notes keep their width and take this share of it as height. */
const RECTANGLE_RATIO = 0.75;
/** Toolbar footprint and gaps used to keep it on screen above or below the selection. */
const PANEL = { width: 660, height: 360, margin: 12, above: 68, below: 24, minTop: 64 };
/** The arrange bar under the toolbar for a multi-note selection: its height and gap. */
const ARRANGE_ROW = 56;

/** Screen-space controls stay readable at every board zoom level. */
export function SelectionToolbar(props: Props) {
  const t = useT();
  const [panel, setPanel] = useState<'color' | 'align' | 'emoji' | null>(null);
  const note = props.notes[0];
  const onlyText = props.notes.every(isText);
  const textNotes = props.notes.filter(isText);
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
  const arranging = props.notes.length > 1 && !locked;
  // Above the selection the whole stack (toolbar, then arrange bar) must clear the notes.
  const above = PANEL.above + (arranging ? ARRANGE_ROW : 0);
  return (
    <div
      className="selection-anchor"
      style={{
        left: Math.max(PANEL.margin, Math.min(left, props.viewport.width - PANEL.width)),
        top: Math.max(
          PANEL.margin,
          Math.min(
            top >= PANEL.minTop + above - PANEL.above ? top - above : bottom + PANEL.below,
            props.viewport.height - PANEL.height,
          ),
        ),
      }}
    >
      <div
        className="selection-toolbar"
        role="toolbar"
        aria-label={t(onlyText ? 'text.toolbar' : 'selection.toolbar')}
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
          {props.notes.length > 1
            ? t('selection.count', { count: props.notes.length })
            : t(onlyText ? 'text.single' : 'selection.single')}
        </span>
        <Tool
          label={t(onlyText ? 'text.color' : 'selection.color')}
          disabled={locked}
          active={panel === 'color'}
          onClick={() => toggle('color')}
        >
          <span
            className="color-preview"
            style={{
              background: onlyText ? textInk(note.textColor) : COLOR_STYLES[note.color].paper,
            }}
          />
        </Tool>
        <span className="selection-divider" />
        <Tool
          label={t('selection.bold')}
          active={!!note.bold}
          disabled={locked}
          onClick={() => props.onFormat({ bold: !note.bold })}
        >
          <b>B</b>
        </Tool>
        <Tool
          label={t('selection.italic')}
          active={!!note.italic}
          disabled={locked}
          onClick={() => props.onFormat({ italic: !note.italic })}
        >
          <i>I</i>
        </Tool>
        <Tool
          label={t('selection.underline')}
          active={!!note.underline}
          disabled={locked}
          onClick={() => props.onFormat({ underline: !note.underline })}
        >
          <u>U</u>
        </Tool>
        <select
          aria-label={t('selection.fontSize')}
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
          <option value="auto">{t('selection.fontAuto')}</option>
          {fontSizes.map((size) => (
            <option key={size} value={size} disabled={size > largestFit}>
              {size}
            </option>
          ))}
        </select>
        <Tool
          label={t('selection.textAlign')}
          active={panel === 'align'}
          disabled={locked}
          onClick={() => toggle('align')}
        >
          <Icon name="align" />
        </Tool>
        {!onlyText && (
          <Tool
            label={t('selection.react')}
            active={panel === 'emoji'}
            onClick={() => toggle('emoji')}
          >
            <Icon name="emoji" />
          </Tool>
        )}
        <span className="selection-divider" />
        <Tool
          label={t(onlyText ? 'text.duplicate' : 'selection.duplicate')}
          onClick={props.onDuplicate}
        >
          <Icon name="duplicate" />
        </Tool>
        <Tool label={t('selection.frame')} onClick={props.onFrame}>
          <Icon name="frame" />
        </Tool>
        {props.notes.length > 1 && (
          <Tool
            label={grouped ? t('selection.ungroup') : t('selection.group')}
            disabled={locked}
            onClick={props.onGroup}
          >
            <Icon name="group" />
          </Tool>
        )}
        <Tool
          label={locked ? t('selection.unlock') : t(onlyText ? 'text.lock' : 'selection.lock')}
          active={locked}
          onClick={() => props.onFormat({ locked: !locked })}
        >
          <Icon name={locked ? 'lock' : 'unlock'} />
        </Tool>
        <Tool label={t('selection.more')} onClick={() => props.onMore({ x: left, y: top })}>
          <Icon name="more" />
        </Tool>
      </div>
      {arranging && <ArrangeToolbar onArrange={props.onArrange} onMatchSize={props.onMatchSize} />}
      {panel && (!locked || panel === 'emoji') && (
        <div className={`selection-popover panel-${panel}`}>
          {panel === 'color' && (
            <>
              {!!textNotes.length && (
                <TextColorPicker
                  colors={textNotes.map((s) => s.textColor)}
                  onChange={(textColor) => {
                    props.onFormat({ textColor });
                    setPanel(null);
                  }}
                />
              )}
              {!onlyText && (
                <>
                  <span className="popover-label">{t('selection.colorHeading')}</span>
                  <div className="color-grid">
                    {STICKY_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={t('selection.colorOption', {
                          color: t(COLOR_STYLES[color].label),
                        })}
                        aria-pressed={props.notes.every((s) => s.color === color)}
                        style={{ background: COLOR_STYLES[color].paper }}
                        onClick={() => {
                          props.onColor(color);
                          setPanel(null);
                        }}
                      />
                    ))}
                  </div>
                  <span className="popover-label">{t('selection.shapeHeading')}</span>
                  <div className="shape-options">
                    <button
                      type="button"
                      onClick={() => props.onResize({ width: note.width, height: note.width })}
                    >
                      {t('selection.square')}
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
                      {t('selection.rectangle')}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
          {panel === 'align' && (
            <>
              <span className="popover-label">{t('selection.textAlignHeading')}</span>
              <div className="shape-options">
                {TEXT_ALIGNS.map((align) => (
                  <button
                    key={align}
                    type="button"
                    aria-pressed={(note.textAlign ?? (isText(note) ? 'left' : 'center')) === align}
                    onClick={() => props.onFormat({ textAlign: align })}
                  >
                    {t(ALIGN_LABELS[align])}
                  </button>
                ))}
              </div>
            </>
          )}
          {panel === 'emoji' && (
            <>
              <span className="popover-label">{t('selection.reactionHeading')}</span>
              <div className="emoji-options">
                {REACTION_EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={t('selection.reaction', { emoji })}
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
