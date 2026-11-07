import type { Locator } from '@playwright/test';
import { test, expect, canvas, point, saved } from './support';

/**
 * Classes of `target` and its ancestors below the note that could scroll or that hold more
 * text than they show. Notes fit their text, so this is always empty.
 */
const scrollingAreas = (target: Locator) =>
  target.evaluate((node) => {
    const result: string[] = [];
    for (
      let current: Element | null = node;
      current && !current.hasAttribute('data-sticky-id');
      current = current.parentElement
    ) {
      const scrolls = ['auto', 'scroll'].includes(getComputedStyle(current).overflowY);
      if (scrolls || current.scrollHeight > current.clientHeight)
        result.push(current.getAttribute('class') ?? '');
    }
    return result;
  });

test('creates square notes only with the tool and fits long text without scrolling', async ({
  page,
}) => {
  await canvas(page).dblclick({ position: { x: 600, y: 350 } });
  await expect(page.locator('[data-sticky-id]')).toHaveCount(0);
  await canvas(page).focus();
  await page.keyboard.press('n');
  const at = await point(page, 600, 350);
  await page.mouse.click(at.x, at.y);
  const input = page.getByRole('textbox', { name: '스티키 내용' });
  await expect(input).toBeFocused();
  await input.fill('메모');
  await input.press('Enter');
  const note = page.locator('[data-sticky-id]');
  const bounds = await note.boundingBox();
  expect(bounds!.width).toBe(bounds!.height);
  await note.dblclick();
  await expect(input).toBeFocused();
  const text = '길게 작성한 메모 내용입니다. '.repeat(120).trim();
  await input.fill(text);
  // Long text shrinks below the chosen-size minimum to fit instead of scrolling.
  await expect
    .poll(() => input.evaluate((node) => parseFloat(getComputedStyle(node).fontSize)))
    .toBeLessThan(8);
  expect(await scrollingAreas(input)).toEqual([]);
  await input.press('Enter');
  await expect.poll(async () => (await saved(page)).stickies[0]?.text).toBe(text);
  expect(await scrollingAreas(note.locator('.sticky-content'))).toEqual([]);
  await canvas(page).dblclick({ position: { x: 1050, y: 650 } });
  await expect(note).toHaveCount(1);
  await page.reload();
  await expect(note).toHaveCount(1);
  expect((await saved(page)).stickies[0]?.text).toBe(text);
});

test('fits the longest note and many short lines without scrolling', async ({ page }) => {
  await canvas(page).focus();
  await page.keyboard.press('n');
  const at = await point(page, 600, 350);
  await page.mouse.click(at.x, at.y);
  const input = page.getByRole('textbox', { name: '스티키 내용' });
  for (const text of ['가'.repeat(3000), 'a\n'.repeat(400)]) {
    await input.fill(text);
    await expect.poll(() => scrollingAreas(input)).toEqual([]);
  }
});

test('shrinks the text as soon as Shift+Enter starts a new line', async ({ page }) => {
  await canvas(page).focus();
  await page.keyboard.press('n');
  const at = await point(page, 600, 350);
  await page.mouse.click(at.x, at.y);
  const input = page.getByRole('textbox', { name: '스티키 내용' });
  await input.fill('짧은 메모');
  const font = () => input.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  const before = await font();
  await input.press('Shift+Enter');
  await expect.poll(font).toBeLessThan(before);
  // The empty line the caret moved to fits, so nothing scrolls out of view.
  expect(await input.evaluate((node) => node.scrollHeight <= node.clientHeight)).toBe(true);
});

test('keeps a chosen font size only while the text fits', async ({ page }) => {
  await canvas(page).focus();
  await page.keyboard.press('n');
  const at = await point(page, 600, 350);
  await page.mouse.click(at.x, at.y);
  const input = page.getByRole('textbox', { name: '스티키 내용' });
  await input.fill('메모');
  await input.press('Enter');
  const note = page.locator('[data-sticky-id]');
  await note.click();
  const sizes = page.getByRole('combobox', { name: '글자 크기' });
  await sizes.selectOption('48');
  await expect(sizes.locator('option[value="64"]')).toBeEnabled();
  await note.dblclick();
  await input.fill('길게 작성한 메모 내용입니다. '.repeat(10));
  await input.press('Enter');
  const text = note.locator('.sticky-text');
  await expect
    .poll(() => text.evaluate((node) => parseFloat(getComputedStyle(node).fontSize)))
    .toBeLessThan(48);
  expect(await scrollingAreas(note.locator('.sticky-content'))).toEqual([]);
  await note.click();
  await expect(sizes.locator('option[value="48"]')).toBeDisabled();
  // The menu shows the size the text is actually drawn at.
  const drawn = await text.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  expect(Number(await sizes.inputValue())).toBe(drawn);
  await expect(sizes.locator('option[value="8"]')).toBeEnabled();
});

test('grows automatic text with the note when the note is resized', async ({ page }) => {
  await canvas(page).focus();
  await page.keyboard.press('n');
  const at = await point(page, 500, 300);
  await page.mouse.click(at.x, at.y);
  const input = page.getByRole('textbox', { name: '스티키 내용' });
  await input.fill('회의에서 나온 아이디어를 정리합니다');
  await input.press('Enter');
  const note = page.locator('[data-sticky-id]');
  const text = note.locator('.sticky-text');
  const font = () => text.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  const before = await font();
  await note.click();
  const handle = page.getByRole('button', { name: '포스트잇 크기 조절' });
  for (let step = 0; step < 6; step++) {
    await handle.press('ArrowRight');
    await handle.press('ArrowDown');
  }
  await expect.poll(font).toBeGreaterThan(before);
  expect(await scrollingAreas(note.locator('.sticky-content'))).toEqual([]);
});
