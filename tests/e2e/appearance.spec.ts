import { test, expect, canvas, frame, openBoard, screenshot, rightClick, point } from './support';

test('keeps frame titles transparent on hover while keeping rename fields readable', async ({
  page,
}, info) => {
  await openBoard(page, {
    stickies: {},
    frames: { f: { ...frame('f', '담당자', 35, 155, 240, 300), color: 'blue' } },
  });
  const title = page.getByRole('button', { name: '프레임: 담당자', exact: true });
  await expect(title).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await title.hover();
  await expect(title).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await title.dblclick();
  const input = page.getByRole('textbox', { name: '프레임 이름', exact: true });
  await expect(input).toBeFocused();
  await expect(input).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await input.fill('개발팀');
  await input.press('Enter');
  const renamed = page.getByRole('button', { name: '프레임: 개발팀', exact: true });
  await expect(renamed).toBeVisible();
  await expect(renamed).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.keyboard.press('Escape');
  await renamed.hover();
  const bounds = await renamed.boundingBox(),
    viewport = page.viewportSize()!;
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  await screenshot(page, info, 'transparent-frame-title');
});

test('keeps the canvas menu inside the viewport and preserves access to board controls', async ({
  page,
}, info) => {
  const viewport = page.viewportSize()!;
  const bounds = await canvas(page).boundingBox();
  const menu = await rightClick(page, { x: viewport.width - 8, y: viewport.height - 95 });
  const menuBox = await menu.boundingBox();
  expect(menuBox!.x).toBeGreaterThanOrEqual(8);
  expect(menuBox!.y).toBeGreaterThanOrEqual(8);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(viewport.width - 7);
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(viewport.height - 7);
  await expect(page.getByRole('button', { name: '포스트잇 도구', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^보드 이름:/ })).toBeVisible();
  expect(bounds!.width).toBeGreaterThan(200);
  await screenshot(page, info, 'canvas-menu');
  await page.keyboard.press('Escape');
  const at = await point(page, 150, 100);
  await page.mouse.click(at.x, at.y);
  await expect(menu).toHaveCount(0);
});
