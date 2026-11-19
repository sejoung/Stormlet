import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { parseBoard } from '../../src/adapters/files/stormlet-format';
import { ko } from '../../src/i18n/locales/ko';
import { en } from '../../src/i18n/locales/en';

for (const slug of ['kpt', 'ideas', 'event-storming', 'architecture', 'kubernetes']) {
  test(`captures downloadable ${slug} example`, async ({ page }, info) => {
    const lang = info.project.name as 'ko' | 'en';
    const messages = lang === 'ko' ? ko : en;
    const path = `public/manual/examples/${lang}/${slug}.stormlet`;
    const board = parseBoard(readFileSync(path, 'utf8'));
    if (slug === 'kpt') await page.setViewportSize({ width: 1600, height: 1300 });
    if (slug === 'architecture') await page.setViewportSize({ width: 1600, height: 900 });
    if (slug === 'kubernetes') await page.setViewportSize({ width: 1280, height: 1300 });
    await page.goto('/');
    await page.locator('input[type="file"]').setInputFiles(path);
    for (const note of Object.values(board.stickies)) {
      await expect(page.getByText(note.text, { exact: true })).toHaveCount(
        Object.values(board.stickies).filter((item) => item.text === note.text).length,
      );
    }
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: messages['menu.view'], exact: true }).click();
    await page.getByRole('menuitem', { name: messages['chrome.fit'], exact: true }).click();
    await expect(page.getByRole('status')).toHaveCount(0, { timeout: 8000 });
    await page.mouse.move(1250, 740);
    await page.screenshot({ path: `public/manual/images/${lang}/example-${slug}.png` });
  });
}
