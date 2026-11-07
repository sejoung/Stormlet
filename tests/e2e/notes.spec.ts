import { test, expect, canvas, point, saved } from './support';

test('creates square notes only with the tool and gives long text one scrolling area', async ({
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
  await expect
    .poll(() => input.evaluate((node) => node.scrollHeight > node.clientHeight))
    .toBe(true);
  const scrolling = await input.evaluate((node) => {
    const result: string[] = [];
    for (let current: Element | null = node; current; current = current.parentElement) {
      if (
        ['auto', 'scroll'].includes(getComputedStyle(current).overflowY) &&
        current.scrollHeight > current.clientHeight
      )
        result.push(current.getAttribute('class') ?? '');
    }
    return result;
  });
  expect(scrolling).toEqual(['sticky-editor']);
  await input.press('Enter');
  await expect.poll(async () => (await saved(page)).stickies[0]?.text).toBe(text);
  await canvas(page).dblclick({ position: { x: 1050, y: 650 } });
  await expect(note).toHaveCount(1);
  await page.reload();
  await expect(note).toHaveCount(1);
  expect((await saved(page)).stickies[0]?.text).toBe(text);
});
