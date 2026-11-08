import { errorDetails, log } from '../diagnostics/log';
export interface ClipboardContent {
  structured: string;
  plain: string;
}
const CUSTOM = 'web application/x-stormlet';

export async function writeClipboard(content: ClipboardContent): Promise<void> {
  if (
    typeof ClipboardItem !== 'undefined' &&
    ClipboardItem.supports?.(CUSTOM) &&
    navigator.clipboard?.write
  ) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([content.plain], { type: 'text/plain' }),
          [CUSTOM]: new Blob([content.structured], { type: 'application/x-stormlet' }),
        }),
      ]);
      return;
    } catch (error) {
      // Plain text remains available in browsers without custom clipboard formats.
      log.debug('clipboard.custom-format-failed', errorDetails(error, false));
    }
  }
  await navigator.clipboard.writeText(content.plain);
}

export async function readClipboard(): Promise<ClipboardContent> {
  if (navigator.clipboard?.read) {
    const items = await navigator.clipboard.read();
    let structured = '';
    let plain = '';
    for (const item of items) {
      if (item.types.includes(CUSTOM)) structured = await (await item.getType(CUSTOM)).text();
      if (item.types.includes('text/plain'))
        plain = await (await item.getType('text/plain')).text();
    }
    return { structured, plain };
  }
  return { structured: '', plain: await navigator.clipboard.readText() };
}

/** Plain text for the system clipboard; rejects where the browser does not allow it. */
export async function writeClipboardText(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) throw new Error('The clipboard API is unavailable.');
  await navigator.clipboard.writeText(text);
}
