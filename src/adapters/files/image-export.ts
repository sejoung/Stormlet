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

export function pngScale(width: number, height: number): number {
  return Math.min(
    PNG_SCALE,
    MAX_SIDE / width,
    MAX_SIDE / height,
    Math.sqrt(MAX_AREA / (width * height)),
  );
}

/** Draws `svg` (`width` × `height` CSS pixels) onto a canvas and encodes it as a PNG. */
export async function svgToPng(svg: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = pngScale(width, height);
    const canvas = document.createElement('canvas');
    // Rounded down, so a board scaled to the limit never lands a pixel past it.
    canvas.width = Math.max(1, Math.floor(width * scale));
    canvas.height = Math.max(1, Math.floor(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas drawing is unavailable.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('The PNG could not be encoded.'))),
        'image/png',
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
