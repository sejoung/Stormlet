import { readFileSync } from 'node:fs';
import { test, expect, canvas } from './support';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

test('keeps an unreadable saved board aside and offers it for download', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('stormlet.board', '{broken'));
  await page.reload();
  const dialog = page.getByRole('dialog', { name: '저장된 보드를 읽을 수 없습니다' });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('stormlet.board.damaged'))).toBe('{broken');
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '저장된 데이터 내려받기' }).click();
  expect((await download).suggestedFilename()).toBe('stormlet-damaged-board.txt');
  await expect(dialog).toBeHidden();
  await expect(canvas(page)).toBeVisible();
});

test('copies diagnostics with the version and recent log from the settings', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: '설정' }).click();
  await page.getByRole('menuitem', { name: '문제 해결…' }).click();
  const dialog = page.getByRole('dialog', { name: '문제 해결' });
  await dialog.getByRole('button', { name: '진단 정보 복사' }).click();
  await expect(dialog.getByRole('status')).toHaveText('진단 정보를 복사했습니다.');
  const report = await page.evaluate(() => navigator.clipboard.readText());
  expect(report).toContain(`Stormlet ${version}\n`);
  expect(report).toContain('Languages: ko-KR (interface: ko)');
  expect(report).toMatch(/INFO app\.started version=/);
  expect(report).toMatch(/INFO store\.loaded notes=0/);
});
