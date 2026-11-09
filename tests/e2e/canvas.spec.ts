import {
  test,
  expect,
  canvas,
  point,
  center,
  openBoard,
  saved,
  note,
  frame,
  rightClick,
  screenshot,
  drag,
} from './support';

test('creates and pastes at the context-menu cursor, with undo and redo', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  let menu = await rightClick(page, await point(page, 500, 300));
  await expect(menu.getByRole('menuitem', { name: /실행 취소/ })).toBeDisabled();
  await menu.getByRole('menuitem', { name: '포스트잇 추가 N', exact: true }).click();
  await page.getByRole('textbox', { name: '스티키 내용' }).fill('우클릭 메모');
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => (await saved(page)).stickies[0])
    .toMatchObject({ text: '우클릭 메모', x: 420, y: 220 });
  await page.evaluate(() => navigator.clipboard.writeText('외부에서 붙여넣기'));
  menu = await rightClick(page, await point(page, 850, 500));
  await menu.getByRole('menuitem', { name: /붙여넣기/ }).click();
  await expect
    .poll(async () =>
      (await saved(page)).stickies.find((item) => item.text === '외부에서 붙여넣기'),
    )
    .toMatchObject({ x: 850, y: 500 });
  menu = await rightClick(page, await point(page, 1100, 650));
  await menu.getByRole('menuitem', { name: /실행 취소/ }).click();
  await expect(page.locator('[data-sticky-id]')).toHaveCount(1);
  menu = await rightClick(page, await point(page, 1100, 650));
  await menu.getByRole('menuitem', { name: /다시 실행/ }).click();
  await expect(page.locator('[data-sticky-id]')).toHaveCount(2);
});

test('copies a whole frame through the menu and pastes independent contents', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const a = note('a', 160, 300, '묶인 메모');
  await openBoard(page, { stickies: { a }, frames: { f: frame('f', '그룹', 100, 240, 400, 300) } });
  const title = page.getByRole('button', { name: '프레임: 그룹', exact: true });
  let menu = await rightClick(page, await center(title));
  await menu.getByRole('menuitem', { name: /복사/ }).click();
  await expect(page.getByRole('status')).toHaveText('프레임을 복사했습니다.');
  menu = await rightClick(page, await point(page, 1000, 550));
  await menu.getByRole('menuitem', { name: /붙여넣기/ }).click();
  await expect(page.locator('[data-frame-id]')).toHaveCount(2);
  await expect(page.locator('[data-sticky-id]')).toHaveCount(2);
  // Saving is batched, so wait for the pasted copy to reach storage.
  await expect.poll(async () => (await saved(page)).frames?.length).toBe(2);
  const data = await saved(page),
    copy = data.frames!.find((item) => item.id !== 'f')!;
  expect(copy).toMatchObject({ x: 800, y: 400, title: '그룹' });
  expect(data.stickies.find((item) => item.id !== 'a')).toMatchObject({
    text: '묶인 메모',
    x: 860,
    y: 460,
  });
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('[data-frame-id]')).toHaveCount(1);
});

test('opens a keyboard context menu and keeps native text editing separate', async ({ page }) => {
  await canvas(page).focus();
  await page.keyboard.press('Shift+F10');
  const menu = page.getByRole('menu', { name: '캔버스 메뉴' });
  await expect(menu.getByRole('menuitem', { name: '포스트잇 추가 N', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: '텍스트 추가 T', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: '프레임 추가 F', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(canvas(page)).toBeFocused();
  await page.keyboard.press('n');
  const at = await point(page, 600, 350);
  await page.mouse.click(at.x, at.y);
  const input = page.getByRole('textbox', { name: '스티키 내용' });
  await input.fill('텍스트 편집');
  await input.click({ button: 'right' });
  await expect(page.getByRole('menu')).toHaveCount(0);
});

test('moves the view from the minimap and remembers it is open', async ({ page }, info) => {
  await openBoard(page, {
    stickies: { a: note('a', 100, 100, '가까운 메모'), b: note('b', 4000, 2600, '먼 메모') },
  });
  await page.getByRole('button', { name: '미니맵' }).click();
  const map = page.getByRole('application', { name: /미니맵/ });
  await expect(map).toBeVisible();
  const far = page.locator('[data-sticky-id="b"]');

  // Clicking a note on the map brings that note to the middle of the canvas.
  await page.mouse.click(...xy(await center(map.locator('rect[fill]').nth(1))));
  const middle = await center(canvas(page));
  await expect.poll(async () => distance(await center(far), middle)).toBeLessThan(4);

  // Dragging the outline pans by the dragged distance at map scale, without jumping.
  const outline = await center(map.locator('.minimap-viewport'));
  const before = await center(far);
  await drag(page, outline, { x: outline.x + 20, y: outline.y });
  const after = await center(far);
  expect(after.x).toBeLessThan(before.x - 20);
  expect(Math.abs(after.y - before.y)).toBeLessThan(1);
  await screenshot(page, info, 'minimap');

  await page.reload();
  await expect(page.getByRole('application', { name: /미니맵/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '미니맵' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

const xy = (at: { x: number; y: number }) => [at.x, at.y] as const;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
