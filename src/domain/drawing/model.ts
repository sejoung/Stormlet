export interface PenStyle {
  strokeColor: string;
  strokeWidth: number;
}
export interface InkPoint {
  x: number;
  y: number;
}
export interface DrawingDetails {
  /** Coordinates relative to the object's box, in [0, 1], so resizing preserves the drawing. */
  ink?: readonly InkPoint[];
  strokeColor?: string;
  strokeWidth?: number;
}
export const DEFAULT_PEN: PenStyle = { strokeColor: '#232436', strokeWidth: 3 };
export const MAX_INK_POINTS = 20000;
export const PEN_WIDTHS = [1, 2, 3, 4, 6, 8, 12, 16] as const;
export const PEN_COLORS = [
  '#232436',
  '#ffffff',
  '#e5484d',
  '#f08c00',
  '#2b9a66',
  '#4262e8',
  '#9b51e0',
] as const;
export const isInkColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
export const isInkWidth = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 16;
export const isDrawing = (item: { objectType?: string }): boolean => item.objectType === 'drawing';
