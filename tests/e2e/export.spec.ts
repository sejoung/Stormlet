import { readFile } from 'node:fs/promises';
import { test, expect, openBoard, note, frame } from './support';
import { DEFAULT_CONNECTION } from '../../src/domain/connections/model';

const board = {
  stickies: {
    a: { ...note('a', 140, 160, '배포 자동화로 릴리스가 빨라짐'), color: 'green' as const },
    b: {
      ...note('b', 380, 160, 'Reviews done within a day'),
      bold: true,
      reactions: [{ emoji: '👍', people: ['x', 'y'] }],
    },
    c: {
      ...note('c', 900, 200, '테스트 환경'),
      color: 'pink' as const,
      textAlign: 'left' as const,
    },
  },
  frames: { f: { ...frame('f', '잘된 점', 100, 100, 520, 300), color: 'green' as const } },
  connections: {
    flow: {
      ...DEFAULT_CONNECTION,
      id: 'flow',
      color: 'black' as const,
      label: '해결',
      from: { stickyId: 'b', side: 'auto' as const },
      to: { stickyId: 'c', side: 'auto' as const },
    },
  },
};

/** Run File → `item` and wait for the file it downloads. */
async function exportAs(page: import('@playwright/test').Page, item: string) {
  await page.getByRole('button', { name: '파일', exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: item }).click(),
  ]);
  return download;
}

test('exports the board as SVG and PNG pictures named after the board', async ({ page }, info) => {
  await openBoard(page, board);
  const svgFile = await exportAs(page, 'SVG 이미지로 내보내기');
  expect(svgFile.suggestedFilename()).toBe('E2E 보드.svg');
  const svg = await readFile((await svgFile.path())!, 'utf8');
  expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  for (const text of ['잘된 점', '해결', 'Reviews', '👍 2']) expect(svg).toContain(text);
  await expect(page.getByRole('status')).toContainText('E2E 보드.svg');

  const pngFile = await exportAs(page, 'PNG 이미지로 내보내기');
  expect(pngFile.suggestedFilename()).toBe('E2E 보드.png');
  const png = await readFile((await pngFile.path())!);
  // The PNG signature, then a 2× image of the SVG's size from the IHDR chunk.
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)];
  const size = svg.match(/width="(\d+)" height="(\d+)"/)!;
  expect([width, height]).toEqual([Number(size[1]) * 2, Number(size[2]) * 2]);
  await info.attach('board.png', { body: png, contentType: 'image/png' });
  await svgFile.saveAs(info.outputPath('board.svg'));
  await pngFile.saveAs(info.outputPath('board.png'));
});

test('offers no export on an empty board', async ({ page }) => {
  await page.getByRole('button', { name: '파일', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'PNG 이미지로 내보내기' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'SVG 이미지로 내보내기' })).toBeDisabled();
});
