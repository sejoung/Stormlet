/**
 * Browser pieces of image export: text measurement for laying out the SVG, and turning that
 * SVG into a PNG. Both use the page's own fonts, so the image matches what is on screen.
 */

/** Measures text with a canvas, in the same fonts the editor renders with. */
export function canvasTextMeasure(): (text: string, font: string) => number {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) throw new Error('Canvas text measurement is unavailable.');
  return (text, font) => {
    context.font = font;
    return context.measureText(text).width;
  };
}

/** Pixel density of an exported PNG, so it stays sharp on high-resolution screens. */
const PNG_SCALE = 2;
/**
 * Browsers refuse canvases past about 16k pixels on a side or 268M pixels in all; large
 * boards are drawn at a lower density instead of failing.
 */
const MAX_SIDE = 16384;
const MAX_AREA = 120_000_000;

/**
 * iOS Safari refuses canvases past about 16.7M pixels (4096²), returning no context or an
 * empty blob, so a failed draw is retried at this area before export gives up.
 */
const SAFE_AREA = 16_000_000;
/** Attempts before reporting failure; each is smaller than the last. */
const MAX_ATTEMPTS = 4;

export function pngScale(width: number, height: number): number {
  return Math.min(
    PNG_SCALE,
    MAX_SIDE / width,
    MAX_SIDE / height,
    Math.sqrt(MAX_AREA / (width * height)),
  );
}

/**
 * Densities to try in turn: the best one, then (if that fails) at most the area every
 * browser allows and at most half the last try, until one is both within it and ≤ 1.
 */
export function pngScales(width: number, height: number): number[] {
  const safe = Math.sqrt(SAFE_AREA / (width * height));
  const scales = [pngScale(width, height)];
  while (scales.length < MAX_ATTEMPTS && scales.at(-1)! > Math.min(1, safe))
    scales.push(Math.min(scales.at(-1)! / 2, safe));
  return scales;
}

/** Draws the decoded image at `scale` and encodes it, or `null` if the canvas refuses. */
async function drawPng(image: HTMLImageElement, width: number, height: number, scale: number) {
  const canvas = document.createElement('canvas');
  // Rounded down, so a board scaled to the limit never lands a pixel past it.
  canvas.width = Math.max(1, Math.floor(width * scale));
  canvas.height = Math.max(1, Math.floor(height * scale));
  try {
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  } finally {
    // Safari holds on to canvas memory until the canvas shrinks; free it before a retry.
    canvas.width = canvas.height = 0;
  }
}

/** Draws `svg` (`width` × `height` CSS pixels) onto a canvas and encodes it as a PNG. */
export async function svgToPng(svg: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    for (const scale of pngScales(width, height)) {
      const blob = await drawPng(image, width, height, scale);
      if (blob) return blob;
    }
    throw new Error('The PNG could not be encoded.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
