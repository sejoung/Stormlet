// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readClipboard,
  writeClipboard,
  writeClipboardText,
} from '../../../../src/adapters/browser/clipboard';

afterEach(() => vi.unstubAllGlobals());
describe('menu clipboard adapter', () => {
  it('reads and writes plain text where custom formats are unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('ClipboardItem', undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText, readText: async () => '외부 내용' } });
    await writeClipboard({ structured: '{}', plain: '메모' });
    expect(writeText).toHaveBeenCalledWith('메모');
    expect(await readClipboard()).toEqual({ structured: '', plain: '외부 내용' });
  });
  it('uses custom board data when supported and falls back to plain text if writing it fails', async () => {
    const custom = 'web application/x-stormlet';
    class Item {
      static supports = (type: string) => type === custom;
      constructor(public content: Record<string, Blob>) {}
    }
    vi.stubGlobal('ClipboardItem', Item);
    const write = vi.fn().mockResolvedValue(undefined),
      writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      clipboard: {
        write,
        writeText,
        read: async () => [
          {
            types: [custom, 'text/plain'],
            getType: async (type: string) => ({
              text: async () => (type === custom ? '{"board":true}' : '내용'),
            }),
          },
        ],
      },
    });
    await writeClipboard({ structured: '{"board":true}', plain: '내용' });
    expect(write.mock.calls[0][0][0].content[custom].type).toBe('application/x-stormlet');
    expect(writeText).not.toHaveBeenCalled();
    expect(await readClipboard()).toEqual({ structured: '{"board":true}', plain: '내용' });
    write.mockRejectedValue(new Error('unsupported'));
    await writeClipboard({ structured: '{}', plain: '대체 텍스트' });
    expect(writeText).toHaveBeenCalledWith('대체 텍스트');
  });
  it('writes plain text and rejects where the clipboard API is missing', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await writeClipboardText('report');
    expect(writeText).toHaveBeenCalledWith('report');
    vi.stubGlobal('navigator', {});
    await expect(writeClipboardText('report')).rejects.toThrow('unavailable');
  });
});
