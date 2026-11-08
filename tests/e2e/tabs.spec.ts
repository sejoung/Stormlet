import type { Page } from '@playwright/test';
import { test, expect, canvas, point, saved } from './support';

async function addNote(page: Page, text: string, x = 300, y = 300) {
  await canvas(page).focus();
  await page.keyboard.press('n');
  const at = await point(page, x, y);
  await page.mouse.click(at.x, at.y);
  await page.keyboard.type(text);
  await page.keyboard.press('Escape');
  await expect
    .poll(async () => (await saved(page)).stickies.map((note) => note.text))
    .toContain(text);
}
const notes = (page: Page) => page.locator('.sticky');

test('a new board opens in a new tab and leaves this one as it is', async ({ page, context }) => {
  await addNote(page, 'Kept here');
  await page.getByRole('button', { name: '파일', exact: true }).click();
  await page.getByRole('menuitem', { name: '새 보드…' }).click();
  const dialog = page.getByRole('dialog', { name: '새 보드' });
  await expect(dialog).toContainText('새 보드는 새 탭에서 열리고');
  await dialog.getByRole('textbox', { name: '보드 이름' }).fill('회고');
  const opened = context.waitForEvent('page');
  await dialog.getByRole('button', { name: '새 보드 만들기' }).click();
  const fresh = await opened;
  await expect(fresh.getByRole('button', { name: '보드 이름: 회고' })).toBeVisible();
  await expect(notes(fresh)).toHaveCount(0);
  // Reloading the new tab keeps its board instead of starting another.
  await fresh.reload();
  await expect(fresh.getByRole('button', { name: '보드 이름: 회고' })).toBeVisible();
  await expect(page.getByRole('button', { name: '보드 이름: My idea board' })).toBeVisible();
  await expect(notes(page)).toHaveCount(1);
});

test('boards of closed tabs come back: from Recent boards, or when the app opens again', async ({
  page,
  context,
}) => {
  await addNote(page, 'First tab');
  const second = await context.newPage();
  await second.goto('/');
  await expect(notes(second)).toHaveCount(0);
  await addNote(second, 'Second tab');
  await second.close();

  await page.getByRole('button', { name: '파일', exact: true }).click();
  await page.getByRole('menuitem', { name: '최근 보드…' }).click();
  const dialog = page.getByRole('dialog', { name: '최근 보드' });
  await expect(dialog.getByRole('listitem')).toHaveCount(1);
  await expect(dialog.getByRole('listitem')).toContainText('포스트잇 1개');
  const opened = context.waitForEvent('page');
  await dialog.getByRole('button', { name: '새 탭에서 열기' }).click();
  const reopened = await opened;
  await expect(reopened.getByText('Second tab')).toBeVisible();

  // Closing every tab and opening the app again resumes the most recently saved board.
  await addNote(reopened, 'Latest', 600, 200);
  await reopened.close();
  await page.close();
  const back = await context.newPage();
  await back.goto('/');
  await expect(back.getByText('Latest')).toBeVisible();
  await expect(back.getByText('Second tab')).toBeVisible();
});
