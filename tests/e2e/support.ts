import { test as base, expect, type Page, type Locator, type TestInfo } from '@playwright/test';
import type { Board, Sticky } from '../../src/domain/model';
import type { Frame } from '../../src/domain/frames/model';
import type { Connection } from '../../src/domain/connections/model';
import { serializeBoard } from '../../src/adapters/files/stormlet-format';

export { expect };
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expect(canvas(page)).toBeVisible();
    await use(page);
    expect(errors, 'The application should not raise browser errors').toEqual([]);
  },
});

/** The board canvas, found by its role and class so it is found in every language. */
export const canvas = (page: Page) => page.locator('.board[role="application"]');
export async function point(page: Page, x: number, y: number) {
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error('Canvas has no rendered bounds');
  return { x: box.x + x, y: box.y + y };
}
export async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}
export async function center(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Object has no rendered bounds');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
export async function openBoard(page: Page, board: Board) {
  await page.locator('input[type="file"]').setInputFiles({
    name: 'e2e.stormlet',
    mimeType: 'application/json',
    buffer: Buffer.from(serializeBoard({ ...board, title: 'E2E 보드' })),
  });
  await expect.poll(async () => (await saved(page)).title).toBe('E2E 보드');
}
export interface SavedBoard {
  title?: string;
  stickies: Sticky[];
  frames?: Frame[];
  connections?: Connection[];
}
export const saved = (page: Page): Promise<SavedBoard> =>
  page.evaluate(() => {
    // Each tab keeps its board under its own slot (ADR 0011).
    const slot = sessionStorage.getItem('stormlet.tab');
    return JSON.parse(localStorage.getItem(`stormlet.board.${slot}`) ?? '{"stickies":[]}');
  });
export const note = (id: string, x: number, y: number, text = id): Sticky => ({
  id,
  x,
  y,
  text,
  z: 1,
  width: 160,
  height: 160,
  color: 'yellow',
  kind: null,
});
export const frame = (
  id: string,
  title: string,
  x: number,
  y: number,
  width = 500,
  height = 320,
): Frame => ({ id, title, x, y, width, height, color: 'none', borderWidth: 2, locked: false });
export async function screenshot(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, { path, contentType: 'image/png' });
}
export async function rightClick(page: Page, at: { x: number; y: number }) {
  await page.mouse.click(at.x, at.y, { button: 'right' });
  const menu = page.getByRole('menu', { name: '캔버스 메뉴' });
  await expect(menu).toBeVisible();
  return menu;
}
