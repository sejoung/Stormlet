import { readFile } from 'node:fs/promises';
import { test, expect, canvas, point, saved, drag, openBoard, note, screenshot } from '../support';
import type { Page } from '@playwright/test';

const drawings = (page: Page) => page.locator('.sticky.is-drawing');
const pen = (page: Page) => page.getByRole('button', { name: '펜', exact: true });
async function draw(page: Page, x = 330, y = 230) {
  await drag(page, await point(page, x, y), await point(page, x + 180, y + 90));
}

test('draws repeatedly over notes with chosen ink, restores files, and undoes whole strokes', async ({
  page,
}) => {
  await openBoard(page, { stickies: { a: note('a', 300, 200, '메모 위에 그리기') } });
  await pen(page).click();
  const settings = page.getByRole('dialog', { name: '펜 설정' });
  await settings.getByRole('button', { name: '펜 색상: 빨강' }).click();
  await settings.getByRole('combobox', { name: '펜 굵기' }).selectOption('8');
  await draw(page);
  await expect(drawings(page)).toHaveCount(1);
  await expect(drawings(page).locator('path')).toHaveAttribute('stroke', '#e5484d');
  await expect(drawings(page).locator('path')).toHaveAttribute('stroke-width', '8');
  await expect(pen(page)).toHaveAttribute('aria-pressed', 'true');
  await draw(page, 560, 350);
  await expect(drawings(page)).toHaveCount(2);
  await expect
    .poll(async () => (await saved(page)).stickies.filter((s) => s.objectType === 'drawing').length)
    .toBe(2);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(drawings(page)).toHaveCount(1);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(drawings(page)).toHaveCount(2);
  await page.reload();
  await expect(drawings(page)).toHaveCount(2);
  await pen(page).click();
  await expect(settings.getByRole('combobox', { name: '펜 굵기' })).toHaveValue('8');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '파일', exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'SVG 이미지로 내보내기' }).click(),
  ]);
  const svg = await readFile((await download.path())!, 'utf8');
  expect(svg.match(/stroke="#e5484d" stroke-width="8"/g)).toHaveLength(2);
});

test('selects, restyles, moves, resizes, copies, locks and deletes drawings', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await canvas(page).focus();
  await page.keyboard.press('p');
  await draw(page);
  await page.keyboard.press('v');
  const ink = drawings(page).first();
  await page.mouse.click((await point(page, 420, 275)).x, (await point(page, 420, 275)).y);
  const toolbar = page.getByRole('toolbar', { name: '그림 도구' });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole('button', { name: '펜 색상: 파랑' }).click();
  await toolbar.getByRole('combobox', { name: '펜 굵기' }).selectOption('12');
  await expect(ink.locator('path')).toHaveAttribute('stroke-width', '12');
  await expect.poll(async () => (await saved(page)).stickies.length).toBe(1);
  const original = (await saved(page)).stickies[0];
  await drag(page, await point(page, 420, 275), await point(page, 520, 375));
  await expect.poll(async () => (await saved(page)).stickies[0].x).toBe(original.x + 100);
  await ink.locator('.handle-se').press('ArrowRight');
  await expect.poll(async () => (await saved(page)).stickies[0].width).toBe(original.width + 20);
  await ink.focus();
  await page.keyboard.press('ControlOrMeta+c');
  await canvas(page).click({ position: { x: 900, y: 600 } });
  await page.keyboard.press('ControlOrMeta+v');
  await expect(drawings(page)).toHaveCount(2);
  await toolbar.getByRole('button', { name: '그림 잠금', exact: true }).click();
  await page.keyboard.press('Delete');
  await expect(drawings(page)).toHaveCount(2);
  await toolbar.getByRole('button', { name: '잠금 해제', exact: true }).click();
  await toolbar.getByRole('button', { name: '그림 삭제' }).click();
  await expect(drawings(page)).toHaveCount(1);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(drawings(page)).toHaveCount(2);
  await canvas(page).click({ position: { x: 1100, y: 100 } });
  await ink.focus();
  await ink.press('Enter');
  await expect(toolbar).toBeVisible();
  await expect(ink).toHaveAttribute('aria-pressed', 'true');
});

test('cancels unfinished ink and supports dots, zoom and temporary hand panning', async ({
  page,
}) => {
  await canvas(page).focus();
  await page.keyboard.press('p');
  const start = await point(page, 320, 220);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 200, start.y + 50);
  await expect(page.locator('.pen-preview')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(drawings(page)).toHaveCount(0);
  await page.keyboard.press('p');
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 100, start.y + 50);
  await page.keyboard.press('v');
  await page.mouse.up();
  await expect(drawings(page)).toHaveCount(0);
  await page.keyboard.press('p');
  await page.getByRole('button', { name: '확대', exact: true }).click();
  await canvas(page).focus();
  await draw(page);
  await expect.poll(async () => (await saved(page)).stickies.length).toBe(1);
  const ink = (await saved(page)).stickies[0];
  expect(ink.width).toBeLessThan(196);
  await canvas(page).click({ position: { x: 650, y: 450 } });
  await expect(drawings(page)).toHaveCount(2);
  await page.keyboard.down('Space');
  await draw(page, 700, 500);
  await page.keyboard.up('Space');
  await expect(drawings(page)).toHaveCount(2);
  await expect(pen(page)).toHaveAttribute('aria-pressed', 'true');
});

test('uses touch and stylus input, keeps ownership, and fits dark and narrow screens', async ({
  page,
}, info) => {
  await pen(page).click();
  const settings = page.getByRole('dialog', { name: '펜 설정' });
  await settings.getByRole('button', { name: '펜 색상: 파랑' }).click();
  const at = await point(page, 330, 230);
  // Dispatch separate events so React finishes each pointer update as with native input.
  await canvas(page).evaluate((node) => {
    node.setPointerCapture = () => {};
  });
  const send = (type: string, id: number, x: number, y: number, pointerType = 'touch') =>
    canvas(page).dispatchEvent(type, {
      pointerId: id,
      pointerType,
      button: 0,
      clientX: x,
      clientY: y,
    });
  await send('pointerdown', 11, at.x, at.y);
  await send('pointermove', 11, at.x + 80, at.y + 70);
  await send('pointerdown', 12, at.x + 300, at.y + 200);
  await send('pointerup', 12, at.x + 300, at.y + 200);
  await send('pointerup', 11, at.x + 140, at.y + 90);
  await expect(drawings(page)).toHaveCount(1);
  await expect.poll(async () => (await saved(page)).stickies[0]?.width).toBe(156);
  await send('pointerdown', 21, at.x + 200, at.y, 'pen');
  await send('pointerup', 21, at.x + 260, at.y + 60, 'pen');
  await expect(drawings(page)).toHaveCount(2);
  await send('pointerdown', 31, at.x, at.y + 150);
  await send('pointermove', 31, at.x + 80, at.y + 200);
  await send('pointercancel', 31, at.x + 80, at.y + 200);
  await send('pointerup', 31, at.x + 80, at.y + 200);
  await expect(drawings(page)).toHaveCount(2);
  await page.emulateMedia({ colorScheme: 'dark' });
  await screenshot(page, info, 'pen-dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await pen(page).click();
  await expect(settings).toBeVisible();
  await expect(settings.getByRole('combobox', { name: '펜 굵기' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await screenshot(page, info, 'pen-narrow');
});
