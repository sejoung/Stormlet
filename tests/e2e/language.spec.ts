import { test, expect, canvas, drag, point } from './support';

test.describe('in an English browser', () => {
  test.use({ locale: 'en-US' });

  test('starts in English, switches to Korean in settings and keeps the choice', async ({
    page,
  }) => {
    await expect(canvas(page)).toHaveAccessibleName('Sticky note board');
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle('Stormlet — Sticky note board');

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('menuitemradio', { name: '한국어' }).click();
    await expect(page.getByRole('button', { name: '설정' })).toBeFocused();
    await expect(page.getByRole('button', { name: '실행 취소' })).toBeVisible();

    await page.reload();
    await expect(canvas(page)).toHaveAccessibleName('포스트잇 보드');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    await expect(page).toHaveTitle('Stormlet — 포스트잇 보드');

    // Generated titles are data and stay English whatever the language.
    await expect(page.getByRole('button', { name: '보드 이름: My idea board' })).toBeVisible();
    await canvas(page).focus();
    await page.keyboard.press('f');
    await drag(page, await point(page, 120, 180), await point(page, 640, 480));
    await expect(page.getByRole('button', { name: '프레임: Frame 1', exact: true })).toBeVisible();
  });
});

test.describe('in a browser language without a translation', () => {
  test.use({ locale: 'fr-FR' });

  test('falls back to English', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'File', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
