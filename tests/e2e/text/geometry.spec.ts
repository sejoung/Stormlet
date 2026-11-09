import { test, expect, canvas, openBoard, note, saved, center, drag, screenshot } from '../support';

/** Visible line bounds, including the board's zoom, compared with the selection box. */
async function margins(text: import('@playwright/test').Locator) {
  return text.evaluate((node) => {
    const paragraph = node.querySelector('p')!;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const glyphs = range.getBoundingClientRect();
    const lines = paragraph.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    return {
      left: glyphs.left - box.left,
      right: box.right - glyphs.right,
      top: lines.top - box.top,
      bottom: box.bottom - lines.bottom,
      width: box.width,
      height: box.height,
      font: parseFloat(getComputedStyle(paragraph).fontSize),
    };
  });
}

test('finishes short Auto text with balanced side margins and keeps the fitted width after reload', async ({
  page,
}, info) => {
  await page.getByRole('button', { name: '텍스트 도구' }).click();
  await canvas(page).click({ position: { x: 350, y: 250 } });
  const input = page.getByRole('textbox', { name: '텍스트 내용' });
  await input.fill('가나');
  const font = await input.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  await input.press('Escape');
  const text = page.locator('.is-text');
  const actual = await margins(text);
  expect(actual.width).toBeLessThan(250);
  expect(Math.abs(actual.left - actual.right)).toBeLessThanOrEqual(2);
  expect(Math.abs(actual.top - actual.bottom), JSON.stringify(actual)).toBeLessThanOrEqual(2);
  expect(actual.font).toBe(font);
  await screenshot(page, info, 'text-tight-width');
  await expect.poll(async () => (await saved(page)).stickies.length).toBe(1);
  const width = (await saved(page)).stickies[0].width;
  await page.reload();
  await expect(text).toBeVisible();
  expect((await saved(page)).stickies[0].width).toBe(width);
});

test('shrinks text below note minimums by dragging, keyboard and exact size, with undo and reload', async ({
  page,
}) => {
  await openBoard(page, {
    stickies: {
      text: {
        ...note('text', 350, 230, '가'),
        objectType: 'text',
        width: 120,
        height: 80,
        autoFont: true,
      },
    },
  });
  const text = page.locator('.is-text');
  await text.click();
  const box = (await text.boundingBox())!;
  const from = await center(text.locator('.handle-se'));
  await page.keyboard.down('ControlOrMeta');
  await drag(page, from, {
    x: from.x + 40 - box.width,
    y: from.y + 24 - box.height,
  });
  await page.keyboard.up('ControlOrMeta');
  await expect
    .poll(async () => (await saved(page)).stickies[0])
    .toMatchObject({ width: 40, height: 24 });
  await text.locator('.handle-se').press('ArrowLeft');
  await expect.poll(async () => (await saved(page)).stickies[0].width).toBe(20);
  await text.click({ button: 'right' });
  const menu = page.getByRole('menu', { name: '텍스트 메뉴' });
  await menu.getByRole('spinbutton', { name: '텍스트 너비' }).fill('16');
  await menu.getByRole('spinbutton', { name: '텍스트 높이' }).fill('16');
  await menu.getByRole('menuitem', { name: '적용', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).stickies[0])
    .toMatchObject({ width: 16, height: 16 });
  await page.getByRole('button', { name: '실행 취소', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).stickies[0])
    .toMatchObject({ width: 20, height: 24 });
  await page.reload();
  await expect(text).toBeVisible();
  await expect(text.locator('p')).toHaveText('가');
});

test('fits multiline text at reduced zoom without shifting left, center or right alignment', async ({
  page,
}) => {
  await page.getByRole('button', { name: '축소', exact: true }).click();
  for (const textAlign of ['left', 'center', 'right'] as const) {
    await openBoard(page, {
      stickies: {
        text: {
          ...note('text', 400, 250, 'initial'),
          objectType: 'text',
          width: 320,
          height: 100,
          autoFont: false,
          fontSize: 24,
          textAlign,
        },
      },
    });
    const text = page.locator('.is-text');
    await text.dblclick();
    const input = page.getByRole('textbox', { name: '텍스트 내용' });
    await input.fill('두 줄\n설명입니다');
    const anchorBefore = await text.locator('.sticky-measure').evaluate((node, alignment) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      return alignment === 'left'
        ? rect.left
        : alignment === 'right'
          ? rect.right
          : (rect.left + rect.right) / 2;
    }, textAlign);
    await input.press('Escape');
    const actual = await margins(text);
    expect(actual.width).toBeLessThan(200);
    expect(actual.height).toBeLessThan(60);
    expect(actual.font).toBe(24);
    expect(Math.abs(actual.left - actual.right)).toBeLessThanOrEqual(2);
    expect(Math.abs(actual.top - actual.bottom), JSON.stringify(actual)).toBeLessThanOrEqual(2);
    const anchorAfter = await text.locator('p').evaluate((node, alignment) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      return alignment === 'left'
        ? rect.left
        : alignment === 'right'
          ? rect.right
          : (rect.left + rect.right) / 2;
    }, textAlign);
    expect(Math.abs(anchorAfter - anchorBefore)).toBeLessThanOrEqual(1);
  }
});

test('fits height as well as width for headings, multiline text and a final empty line', async ({
  page,
}, info) => {
  for (const content of ['Title', '두 줄\n설명입니다', 'Hello 😀\n설명\n']) {
    await openBoard(page, {
      stickies: {
        text: {
          ...note('text', 400, 250, 'old'),
          objectType: 'text',
          width: 320,
          height: 200,
          autoFont: false,
          fontSize: 24,
        },
      },
    });
    const text = page.locator('.is-text');
    await text.dblclick();
    const input = page.getByRole('textbox', { name: '텍스트 내용' });
    await input.fill(content);
    await input.press('Escape');
    const actual = await margins(text);
    expect(actual.height).toBeLessThan(120);
    expect(actual.font).toBe(24);
    expect(Math.abs(actual.top - actual.bottom), JSON.stringify(actual)).toBeLessThanOrEqual(1);
    expect(await text.locator('p').textContent()).toBe(content);
    await expect
      .poll(async () => (await saved(page)).stickies[0])
      .toMatchObject({ y: 250, height: actual.height, text: content });
    if (content === '두 줄\n설명입니다') await screenshot(page, info, 'text-balanced-margins');
    await page.getByRole('button', { name: '실행 취소', exact: true }).click();
    await expect
      .poll(async () => (await saved(page)).stickies[0])
      .toMatchObject({ width: 320, height: 200, text: 'old' });
  }
});
