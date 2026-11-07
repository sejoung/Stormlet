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
    } catch {
      /* Plain text remains available in browsers without custom clipboard formats. */
    }
  }
  await navigator.clipboard.writeText(content.plain);
}

export async function readClipboard(): Promise<ClipboardContent> {
  if (navigator.clipboard?.read) {
    const items = await navigator.clipboard.read();
    let structured = '',
      plain = '';
    for (const item of items) {
      if (item.types.includes(CUSTOM)) structured = await (await item.getType(CUSTOM)).text();
      if (item.types.includes('text/plain'))
        plain = await (await item.getType('text/plain')).text();
    }
    return { structured, plain };
  }
  return { structured: '', plain: await navigator.clipboard.readText() };
}
