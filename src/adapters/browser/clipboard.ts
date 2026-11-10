import { errorDetails, log } from '../diagnostics/log';
export interface ClipboardContent {
  structured: string;
  plain: string;
}
/**
 * Board content's type in clipboard events. The async clipboard API writes it under the web
 * custom format below instead; Chromium keeps the two apart, so neither path sees the other.
 */
export const STORMLET_TYPE = 'application/x-stormlet';
const CUSTOM = `web ${STORMLET_TYPE}`;

const supportsCustomFormat = () =>
  typeof ClipboardItem !== 'undefined' && !!ClipboardItem.supports?.(CUSTOM);

export async function writeClipboard(content: ClipboardContent): Promise<void> {
  if (supportsCustomFormat() && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([content.plain], { type: 'text/plain' }),
          [CUSTOM]: new Blob([content.structured], { type: STORMLET_TYPE }),
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

/**
 * Whether reading is already allowed. A paste of outside text (a spreadsheet, say) must never
 * raise the browser's permission prompt, so the read is only tried once the user granted it,
 * e.g. through the menu's Paste.
 */
async function readAllowed(): Promise<boolean> {
  try {
    const status = await navigator.permissions?.query({ name: 'clipboard-read' as PermissionName });
    return status?.state === 'granted';
  } catch {
    return false;
  }
}

/** Whether `readCustomFormat` can find anything, so callers can skip waiting for it. */
export const canReadCustomFormat = () => supportsCustomFormat() && !!navigator.clipboard?.read;

/**
 * Board content a paste event could not see: a copy made through the async API (the menu)
 * is only in the web custom format. Returned only when it goes with `plain`, the text the
 * event carried, so a stale or unrelated read never replaces what is being pasted. '' when
 * there is none or the browser refuses to read.
 */
export async function readCustomFormat(plain: string): Promise<string> {
  if (!canReadCustomFormat() || !(await readAllowed())) return '';
  try {
    const content = await readClipboard();
    return content.plain === plain ? content.structured : '';
  } catch (error) {
    log.debug('clipboard.custom-format-unreadable', errorDetails(error, false));
    return '';
  }
}

/** Plain text for the system clipboard; rejects where the browser does not allow it. */
export async function writeClipboardText(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) throw new Error('The clipboard API is unavailable.');
  await navigator.clipboard.writeText(text);
}
