import { useEffect, useRef, type PointerEvent } from 'react';
import type { StickyAppearance } from '../../domain/model';
import type { Point } from '../../engine/viewport';
import { COLOR_STYLES, type BoardTool, type PaletteEntry } from '../board/kinds';
import { Icon } from './Icon';

export interface PaletteDraft {
  appearance: StickyAppearance;
  point: Point;
}

interface Props {
  entries: PaletteEntry[];
  appearance: StickyAppearance;
  tool: BoardTool;
  onTool(tool: BoardTool): void;
  onPick(appearance: StickyAppearance): void;
  onDraft(draft: PaletteDraft | null): void;
  onDrop(draft: PaletteDraft): void;
  onAddCenter(): void;
  onBulk(): void;
}

/** Pointer capture keeps palette dragging consistent with mouse, pen and touch. */
export function StickyPalette(props: Props) {
  const gesture = useRef<{ start: Point; appearance: StickyAppearance; dragging: boolean } | null>(
    null,
  );
  const suppressClick = useRef(false);
  const { onDraft } = props;
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !gesture.current) return;
      gesture.current = null;
      suppressClick.current = true;
      onDraft(null);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [onDraft]);
  const point = (event: PointerEvent): Point => ({ x: event.clientX, y: event.clientY });
  const cancel = () => {
    gesture.current = null;
    props.onDraft(null);
  };
  return (
    <aside className="tool-panel" aria-label="보드 도구">
      <button
        type="button"
        className="interact-tool"
        aria-pressed={props.tool === 'interact'}
        title="드래그로 영역 선택 (V) · Space를 누르면 보드 이동"
        onClick={() => props.onTool('interact')}
      >
        <Icon name="select" />
        <span>선택 · 이동</span>
      </button>
      <button
        type="button"
        className="interact-tool"
        aria-pressed={props.tool === 'hand'}
        title="보드 이동 (H) · Space+드래그"
        onClick={() => props.onTool('hand')}
      >
        <Icon name="pan" />
        <span>손 도구</span>
      </button>
      <button
        type="button"
        className="interact-tool"
        aria-pressed={props.tool === 'sticky'}
        title="포스트잇 도구 (N)"
        onClick={() => props.onTool('sticky')}
      >
        <Icon name="note" />
        <span>
          포스트잇 <kbd>N</kbd>
        </span>
      </button>
      <div className="palette-heading">
        <Icon name="note" />
        <h2>포스트잇</h2>
      </div>
      <p className="palette-hint">보드로 끌어다 놓으세요</p>
      <div
        className={`palette${props.entries.some((entry) => entry.kind) ? ' has-roles' : ''}`}
        role="group"
        aria-label="포스트잇 색상"
      >
        {props.entries.map((entry, index) => (
          <button
            key={entry.label}
            type="button"
            className="palette-item"
            aria-label={entry.label}
            title={`${entry.label}${index < 8 ? ` (${index + 1})` : ''} · 끌어서 붙이기`}
            aria-pressed={
              props.appearance.color === entry.color && props.appearance.kind === entry.kind
            }
            style={{
              background: COLOR_STYLES[entry.color].paper,
              color: COLOR_STYLES[entry.color].ink,
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              suppressClick.current = false;
              gesture.current = {
                start: point(event),
                appearance: { color: entry.color, kind: entry.kind },
                dragging: false,
              };
            }}
            onPointerMove={(event) => {
              const current = gesture.current;
              if (!current) return;
              const at = point(event);
              if (
                !current.dragging &&
                Math.hypot(at.x - current.start.x, at.y - current.start.y) < 5
              )
                return;
              current.dragging = true;
              props.onDraft({ appearance: current.appearance, point: at });
            }}
            onPointerUp={(event) => {
              const current = gesture.current;
              if (current?.dragging) {
                suppressClick.current = true;
                props.onDrop({ appearance: current.appearance, point: point(event) });
              }
              cancel();
            }}
            onPointerCancel={() => {
              suppressClick.current = true;
              cancel();
            }}
            onLostPointerCapture={cancel}
            onClick={() => {
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              props.onPick({ color: entry.color, kind: entry.kind });
            }}
          >
            <span className="palette-number" aria-hidden="true">
              {index < 8 ? index + 1 : ''}
            </span>
            <span className="palette-label">{entry.kind ? entry.label : ''}</span>
          </button>
        ))}
      </div>
      <button type="button" className="add-center" onClick={props.onAddCenter}>
        <Icon name="plus" />
        <span>가운데 붙이기</span>
      </button>
      <button type="button" className="add-center bulk-trigger" onClick={props.onBulk}>
        <Icon name="grid" />
        <span>여러 개 한 번에</span>
      </button>
      <p className="palette-footnote">선택 → 입력 → 자유롭게 이동</p>
    </aside>
  );
}
