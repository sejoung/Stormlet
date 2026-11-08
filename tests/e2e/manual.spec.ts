import type { Page } from '@playwright/test';
import { test, expect } from './support';

/** Every contents link has its section, and every screenshot loads with a description. */
async function checkGuide(guide: Page, contents: string) {
  const targets = await guide
    .getByRole('navigation', { name: contents })
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')!));
  expect(targets).toHaveLength(11);
  for (const target of targets) await expect(guide.locator(target)).toHaveCount(1);
  const images = guide.locator('main img');
  expect(await images.count()).toBe(14);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveAttribute('alt', /.+/);
    await expect
      .poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
  }
}

test('opens the user guide from the toolbar, Settings and the shortcut help, in both languages', async ({
  page,
  context,
}) => {
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('menuitem', { name: '단축키 도움말' }).click();
  await expect(page.getByRole('link', { name: '전체 사용 설명서 보기 ↗' })).toHaveAttribute(
    'href',
    'manual/index.html',
  );
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '설정', exact: true }).click();
  const [fromSettings] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('menuitem', { name: '사용 설명서' }).click(),
  ]);
  await expect(fromSettings).toHaveTitle('Stormlet 사용 설명서');
  await fromSettings.close();

  // The toolbar keeps the guide in sight, beside Settings.
  const [guide] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('banner').getByRole('link', { name: '사용 설명서', exact: true }).click(),
  ]);
  await guide.waitForLoadState();
  await expect(guide).toHaveTitle('Stormlet 사용 설명서');
  await expect(guide.locator('html')).toHaveAttribute('lang', 'ko');
  await checkGuide(guide, '목차');

  await guide.getByRole('link', { name: 'English', exact: true }).click();
  await expect(guide).toHaveTitle('Stormlet User Guide');
  await checkGuide(guide, 'Contents');
  await guide.getByRole('link', { name: 'Open the board' }).first().click();
  await expect(guide.locator('.board[role="application"]')).toBeVisible();
});
