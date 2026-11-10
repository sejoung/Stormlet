import { byStackOrder, type Board, type Sticky } from '../../domain/model';
import { byAreaDescending, type Frame } from '../../domain/frames/model';
import { CONNECTION_COLORS, type Connection } from '../../domain/connections/model';
import type { Rect } from '../../domain/geometry/bounds';
import { NOTE_LINE_HEIGHT, contentPadding } from '../../engine/text-fit';
import { connectionGeometry } from '../../engine/connections/geometry';
import { COLOR_STYLES } from '../board/kinds';
import { isText } from '../../domain/text/model';
import { textInk } from '../text/colors';
import { LINE_COLORS } from '../connections/colors';
import { FRAME_STYLES } from '../frames/colors';
import { FONT_FAMILY, layoutNote, scaledMeasure, xmlText, type MeasureText } from './text-layout';

/** The light theme's colours: an export looks the same whichever theme the editor is in. */
const THEME = { background: '#ffffff', text: '#232436', muted: '#737485', border: '#e6e6ee' };
/** Space around the board's content in the image. */
const MARGIN = 40;
/** Frame titles sit above the frame (CSS `bottom: calc(100% + 5px)`, 24px tall). */
const FRAME_TITLE = { offset: 5, height: 24, inset: 8, font: 13 };
/** Reaction pills under a note, sized like `.note-reactions` (10px text, 3px × 6px padding). */
const REACTION = { gap: 8, height: 22, font: 10, padding: 7, spacing: 4 };
/** Connection labels sit this far above the line's middle, with a halo for legibility. */
const LABEL = { rise: 10, font: 14, halo: 6 };

export interface BoardImage {
  svg: string;
  width: number;
  height: number;
}

const escape = (text: string) =>
  xmlText(text).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
const n = (value: number) => Math.round(value * 100) / 100;

function frameSvg(frame: Frame, measure: MeasureText) {
  const inset = frame.borderWidth / 2;
  const fill = FRAME_STYLES[frame.color].fill;
  const titleY = frame.y - FRAME_TITLE.offset - FRAME_TITLE.height / 2;
  const font = `500 ${FRAME_TITLE.font}px ${FONT_FAMILY}`;
  return {
    svg: [
      `<rect x="${n(frame.x + inset)}" y="${n(frame.y + inset)}" width="${n(frame.width - frame.borderWidth)}" height="${n(frame.height - frame.borderWidth)}"`,
      ` fill="${fill === 'transparent' ? 'none' : fill}" fill-opacity="0.24"`,
      ` stroke="${THEME.muted}" stroke-width="${frame.borderWidth}"/>`,
      `<text x="${n(frame.x + FRAME_TITLE.inset)}" y="${n(titleY + FRAME_TITLE.font * 0.35)}"`,
      ` font-size="${FRAME_TITLE.font}" font-weight="500" fill="${THEME.text}">${escape(frame.title)}</text>`,
    ].join(''),
    bounds: {
      x: frame.x,
      y: frame.y - FRAME_TITLE.offset - FRAME_TITLE.height,
      width: Math.max(frame.width, measure(xmlText(frame.title), font) + FRAME_TITLE.inset * 2),
      height: frame.height + FRAME_TITLE.offset + FRAME_TITLE.height,
    },
  };
}

function connectionSvg(board: Board, line: Connection) {
  const shape = connectionGeometry(board, line);
  if (!shape) return null;
  const marker = `url(#arrow-${line.color})`;
  const parts = [
    `<path d="${shape.path}" fill="none" stroke="${LINE_COLORS[line.color].color}"`,
    ` stroke-width="${line.width}" stroke-linecap="round" stroke-linejoin="round"`,
    line.dashed ? ' stroke-dasharray="8 6"' : '',
    line.startArrow ? ` marker-start="${marker}"` : '',
    line.endArrow ? ` marker-end="${marker}"` : '',
    '/>',
  ];
  if (line.label)
    parts.push(
      `<text x="${n(shape.label.x)}" y="${n(shape.label.y - LABEL.rise)}" text-anchor="middle"`,
      ` font-size="${LABEL.font}" fill="${THEME.text}" stroke="${THEME.background}"`,
      ` stroke-width="${LABEL.halo}" stroke-linejoin="round" paint-order="stroke">${escape(line.label)}</text>`,
    );
  // Leave room for arrowheads and the label above the middle of the line.
  const pad = line.width * 4 + (line.label ? LABEL.font + LABEL.rise : 0);
  const { x, y, width, height } = shape.bounds;
  return {
    svg: parts.join(''),
    bounds: { x: x - pad, y: y - pad, width: width + pad * 2, height: height + pad * 2 },
  };
}

function noteSvg(note: Sticky, measureAt: ReturnType<typeof scaledMeasure>, measure: MeasureText) {
  const style = COLOR_STYLES[note.color];
  const freeText = isText(note);
  const padding = contentPadding(note);
  const ink = freeText
    ? note.textColor && note.textColor !== 'default'
      ? textInk(note.textColor)
      : THEME.text
    : style.ink;
  const { size, lines } = layoutNote(note, measureAt);
  const lineHeight = size * NOTE_LINE_HEIGHT;
  // Text is centred vertically in the padded box, as `margin: auto 0` does on screen.
  const top =
    note.y + padding + (freeText ? 0 : (note.height - padding * 2 - lines.length * lineHeight) / 2);
  const align = note.textAlign ?? (freeText ? 'left' : 'center');
  const x =
    align === 'left'
      ? note.x + padding
      : align === 'right'
        ? note.x + note.width - padding
        : note.x + note.width / 2;
  const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
  const text = lines
    .map(
      (line, index) =>
        `<text x="${n(x)}" y="${n(top + index * lineHeight + lineHeight / 2 + size * 0.35)}">${escape(line)}</text>`,
    )
    .join('');
  const parts = [
    ...(freeText
      ? []
      : [
          `<rect x="${n(note.x)}" y="${n(note.y)}" width="${n(note.width)}" height="${n(note.height)}" rx="2" fill="${style.paper}" filter="url(#note-shadow)"/>`,
        ]),
    `<g font-size="${n(size)}" fill="${ink}" text-anchor="${anchor}"`,
    note.bold ? ' font-weight="700"' : '',
    note.italic ? ' font-style="italic"' : '',
    note.underline ? ' text-decoration="underline"' : '',
    ` xml:space="preserve">${text}</g>`,
  ];
  let height = note.height;
  const reactions = note.reactions ?? [];
  if (reactions.length) {
    let left = note.x;
    const y = note.y + note.height + REACTION.gap;
    const font = `${REACTION.font}px ${FONT_FAMILY}`;
    for (const reaction of reactions) {
      const label = `${reaction.emoji} ${reaction.people.length}`;
      const width = measure(label, font) + REACTION.padding * 2;
      parts.push(
        `<rect x="${n(left)}" y="${n(y)}" width="${n(width)}" height="${REACTION.height}" rx="${REACTION.height / 2}" fill="${THEME.background}" stroke="${THEME.border}"/>`,
        `<text x="${n(left + width / 2)}" y="${n(y + REACTION.height / 2 + REACTION.font * 0.35)}" text-anchor="middle" font-size="${REACTION.font}" fill="${THEME.text}">${escape(label)}</text>`,
      );
      left += width + REACTION.spacing;
    }
    height += REACTION.gap + REACTION.height;
  }
  return { svg: parts.join(''), bounds: { x: note.x, y: note.y, width: note.width, height } };
}

const ARROWS = CONNECTION_COLORS.map(
  (color) =>
    `<marker id="arrow-${color}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9 Z" fill="${LINE_COLORS[color].color}"/></marker>`,
).join('');
const SHADOW =
  '<filter id="note-shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.1"/></filter>';

function union(rects: readonly Rect[]): Rect {
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * The board drawn as a standalone SVG: frames, then lines, then notes in stacking order, in
 * the light theme on a white background. Text is wrapped and fitted with `measure`, so it
 * matches the editor when measured with the browser's fonts. `null` for an empty board.
 */
export function boardSvg(board: Board, measure: MeasureText): BoardImage | null {
  const measureAt = scaledMeasure(measure);
  const frames = Object.values(board.frames ?? {})
    .sort(byAreaDescending)
    .map((frame) => frameSvg(frame, measure));
  const lines = Object.values(board.connections ?? {}).flatMap(
    (line) => connectionSvg(board, line) ?? [],
  );
  const notes = Object.values(board.stickies)
    .sort(byStackOrder)
    .map((note) => noteSvg(note, measureAt, measure));
  const parts = [...frames, ...lines, ...notes];
  if (!parts.length) return null;
  const content = union(parts.map((part) => part.bounds));
  const x = Math.floor(content.x - MARGIN);
  const y = Math.floor(content.y - MARGIN);
  const width = Math.ceil(content.width + MARGIN * 2);
  const height = Math.ceil(content.height + MARGIN * 2);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}"`,
    ` font-family="${escape(FONT_FAMILY)}">`,
    `<defs>${ARROWS}${SHADOW}</defs>`,
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${THEME.background}"/>`,
    ...parts.map((part) => part.svg),
    '</svg>',
  ].join('');
  return { svg, width, height };
}
