import {
  test,
  expect,
  canvas,
  point,
  drag,
  center,
  openBoard,
  saved,
  note,
  frame,
  screenshot,
  rightClick,
} from './support';
import { DEFAULT_CONNECTION } from '../../src/domain/connections/model';

test('draws a frame, edits its name and preserves its border and fill after reload', async ({
  page,
}, info) => {
  await canvas(page).focus();
  await page.keyboard.press('f');
  await drag(page, await point(page, 120, 180), await point(page, 640, 480));
  const title = page.getByRole('button', { name: '프레임: 프레임 1', exact: true });
  await expect(title).toBeVisible();
  await title.dblclick();
  const name = page.getByRole('textbox', { name: '프레임 이름', exact: true });
  await expect(name).toBeFocused();
  await name.fill('개발');
  await name.press('Enter');
  const renamed = page.getByRole('button', { name: '프레임: 개발', exact: true });
  await expect(renamed).toBeVisible();
  await page.getByRole('combobox', { name: '프레임 테두리 두께' }).selectOption('8');
  await page.getByRole('button', { name: '파란색', exact: true }).click();
  await expect(page.locator('.frame-background')).toHaveCSS('border-top-width', '8px');
  await expect(renamed).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect
    .poll(async () => (await saved(page)).frames?.[0])
    .toMatchObject({
      title: '개발',
      x: 120,
      y: 180,
      width: 520,
      height: 300,
      borderWidth: 8,
      color: 'blue',
    });
  await page.reload();
  await expect(renamed).toBeVisible();
  await expect(page.locator('.frame-background')).toHaveCSS('border-top-width', '8px');
  await screenshot(page, info, 'frame-persisted');
});

test('moves and resizes a frame with its contents and attached line; deleting keeps notes and undo restores the flow', async ({
  page,
}) => {
  const a = note('a', 180, 260, '안쪽'),
    b = note('b', 920, 360, '바깥쪽');
  await openBoard(page, {
    stickies: { a, b },
    frames: { f: frame('f', '영역', 120, 200) },
    connections: {
      flow: {
        id: 'flow',
        ...DEFAULT_CONNECTION,
        from: { frameId: 'f', side: 'right' },
        to: { stickyId: 'b', side: 'left' },
      },
    },
  });
  const title = page.getByRole('button', { name: '프레임: 영역', exact: true });
  const inside = page.locator('[data-sticky-id="a"]'),
    outside = page.locator('[data-sticky-id="b"]');
  const line = page.locator('[data-connection-id="flow"] .connection-stroke');
  const before = await inside.boundingBox(),
    beforeOutside = await outside.boundingBox();
  const originalPath = await line.getAttribute('d');
  const at = await center(title);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 70, at.y + 40, { steps: 10 });
  await expect.poll(async () => (await inside.boundingBox())!.x).toBeCloseTo(before!.x + 70, 0);
  expect((await saved(page)).frames?.[0].x).toBe(120);
  await expect(line).not.toHaveAttribute('d', originalPath!);
  await page.mouse.up();
  await expect.poll(async () => (await saved(page)).frames?.[0]).toMatchObject({ x: 190, y: 240 });
  expect(await outside.boundingBox()).toEqual(beforeOutside);
  const handle = await center(page.getByRole('button', { name: '프레임 크기 조절' }));
  await drag(page, handle, { x: handle.x + 100, y: handle.y + 60 });
  await expect
    .poll(async () => (await saved(page)).frames?.[0])
    .toMatchObject({ width: 600, height: 380 });
  expect((await saved(page)).stickies.find((item) => item.id === 'a')).toMatchObject({
    x: 250,
    y: 300,
    width: 160,
    height: 160,
  });
  const menu = await rightClick(page, await center(title));
  await menu.getByRole('menuitem', { name: '프레임 삭제', exact: true }).click();
  await expect(title).toHaveCount(0);
  await expect(inside).toBeVisible();
  await expect(line).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(title).toBeVisible();
  await expect(line).toBeVisible();
});

test('connects frame ports by dragging and reconnects a line endpoint to a note', async ({
  page,
}, info) => {
  const a = note('a', 850, 80, '도착');
  await openBoard(page, {
    stickies: { a },
    frames: {
      left: frame('left', '시작', 100, 240, 350, 300),
      right: frame('right', '종료', 750, 260, 350, 300),
    },
  });
  await page.getByRole('button', { name: '프레임: 시작', exact: true }).click();
  const source = page
    .locator('[data-frame-id="left"]')
    .getByRole('button', { name: '오른쪽 연결점' });
  await source.click({ trial: true });
  await drag(page, await center(source), await point(page, 750, 410));
  await expect
    .poll(async () => (await saved(page)).connections?.[0])
    .toMatchObject({ from: { frameId: 'left', side: 'right' }, to: { frameId: 'right' } });
  const target = page.getByRole('button', { name: '연결선 끝점 이동' });
  await target.click({ trial: true });
  await drag(page, await center(target), await center(page.locator('[data-sticky-id="a"]')));
  await expect
    .poll(async () => (await saved(page)).connections?.[0].to)
    .toMatchObject({ stickyId: 'a' });
  await screenshot(page, info, 'frame-connection');
});

test('connects a frame to a note with L and keyboard ports without entering title editing', async ({
  page,
}) => {
  const a = note('a', 750, 350, '완료');
  await openBoard(page, { stickies: { a }, frames: { f: frame('f', '작업', 100, 240, 400, 300) } });
  await canvas(page).focus();
  await page.keyboard.press('l');
  await page.getByRole('button', { name: '프레임: 작업', exact: true }).click();
  await page.locator('[data-sticky-id="a"]').click();
  await expect
    .poll(async () => (await saved(page)).connections?.[0])
    .toMatchObject({ from: { frameId: 'f' }, to: { stickyId: 'a' } });
  await expect(page.getByRole('textbox', { name: '프레임 이름', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '프레임: 작업', exact: true }).click();
  const port = page.locator('[data-frame-id="f"]').getByRole('button', { name: '아래 연결점' });
  await port.focus();
  await port.press('Space');
  const destination = page.locator('[data-sticky-id="a"]');
  await destination.focus();
  await destination.press('Enter');
  await expect.poll(async () => (await saved(page)).connections?.length).toBe(2);
});
