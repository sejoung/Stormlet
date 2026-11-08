import { test, expect, canvas, point } from './support';
import { mockDrive, mockGoogleScripts } from './google';
import { serializeBoard } from '../../src/adapters/files/stormlet-format';
import { parseBoard } from '../../src/adapters/files/stormlet-format';

const driveButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /^Google Drive:/ });

/** Run a File menu item once Google's scripts have loaded. */
async function fromFile(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('button', { name: '파일' }).click();
  const item = page.getByRole('menuitem', { name });
  await expect(item).toBeEnabled();
  await item.click();
}
const pickFolder = (page: import('@playwright/test').Page) =>
  page.getByRole('dialog', { name: '이 보드를 저장할 폴더 선택' }).getByRole('button').click();

test('saves to a Drive folder, autosaves edits and merges changes made elsewhere after reconnecting', async ({
  page,
}) => {
  await mockGoogleScripts(page);
  const drive = await mockDrive(page);
  await fromFile(page, 'Drive 폴더에 저장…');
  await pickFolder(page);
  await expect(driveButton(page)).toHaveText('저장됨');
  expect([...drive.files.keys()]).toEqual(['created-1']);
  expect(drive.files.get('created-1')).toMatchObject({
    name: 'My idea board.stormlet',
    version: 1,
    parents: ['folder-1'],
  });

  // A new note is saved to the file once editing pauses.
  await canvas(page).focus();
  await page.keyboard.press('n');
  const at = await point(page, 300, 300);
  await page.mouse.click(at.x, at.y);
  await page.keyboard.type('Drive note');
  await page.keyboard.press('Escape');
  await expect(driveButton(page)).toHaveText('저장 중…');
  await expect(driveButton(page)).toHaveText('저장됨');
  const saved = drive.files.get('created-1')!;
  expect(Object.values(parseBoard(saved.content).stickies).map((note) => note.text)).toEqual([
    'Drive note',
  ]);
  expect(saved.version).toBeGreaterThan(1);

  // After a reload the token is gone; meanwhile someone renames the board in Drive.
  await page.reload();
  await expect(driveButton(page)).toHaveText('다시 연결');
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain('e2e-token');
  const remote = parseBoard(saved.content);
  Object.assign(saved, {
    content: serializeBoard({ ...remote, title: 'Renamed elsewhere' }),
    version: saved.version + 1,
  });
  await driveButton(page).click();
  await expect(driveButton(page)).toHaveText('저장됨');
  await expect(page.getByRole('button', { name: '보드 이름: Renamed elsewhere' })).toBeVisible();
  await expect(page.getByRole('button', { name: /: Drive note$/ })).toBeVisible();
});

test('opens a board from Drive', async ({ page }) => {
  await mockGoogleScripts(page);
  const drive = await mockDrive(page);
  drive.files.set('shared', {
    name: 'Shared.stormlet',
    version: 7,
    parents: [],
    content: serializeBoard({
      title: 'Shared',
      stickies: {
        s: {
          id: 's',
          kind: null,
          color: 'blue',
          text: 'From Drive',
          x: 200,
          y: 200,
          z: 1,
          width: 160,
          height: 160,
        },
      },
    }),
  });
  await fromFile(page, 'Drive에서 열기…');
  await page.getByRole('dialog', { name: 'Stormlet 보드 열기' }).getByRole('button').click();
  await expect(page.getByText('Drive에서 Shared.stormlet을(를) 열었습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '보드 이름: Shared' })).toBeVisible();
  await expect(page.getByRole('button', { name: /: From Drive$/ })).toBeVisible();
  await expect(driveButton(page)).toHaveText('저장됨');
  expect(drive.requests.filter((request) => request.startsWith('PATCH'))).toEqual([]);
});

test('a new tab has a board of its own but takes over the connection, and a disconnect ends both', async ({
  page,
  context,
}) => {
  await mockGoogleScripts(context);
  const drive = await mockDrive(context);
  await fromFile(page, 'Drive 폴더에 저장…');
  await pickFolder(page);
  await expect(driveButton(page)).toHaveText('저장됨');

  const second = await context.newPage();
  await second.goto('/');
  // Its own, empty board; but the open tab hands over its token, with nothing stored.
  await expect(second.locator('.sticky')).toHaveCount(0);
  await expect(driveButton(second)).toHaveCount(0);
  await second.getByRole('button', { name: '파일', exact: true }).click();
  await expect(second.getByRole('menuitem', { name: 'Google Drive 연결 해제' })).toBeVisible();
  await expect(
    second.getByRole('menuitem', { name: 'Google Drive 연결', exact: true }),
  ).toHaveCount(0);
  await second.keyboard.press('Escape');
  expect(await second.evaluate(() => document.documentElement.dataset.signIns)).toBeUndefined();
  expect(
    await second.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain('e2e-token');
  expect(drive.requests.filter((request) => request.startsWith('PATCH'))).toEqual([]);

  await fromFile(second, 'Google Drive 연결 해제');
  await expect(driveButton(page)).toHaveCount(0);
});

test('renews access on a click before it runs out', async ({ page }) => {
  await page.clock.install();
  await page.reload();
  await mockGoogleScripts(page);
  await mockDrive(page);
  await fromFile(page, 'Drive 폴더에 저장…');
  await pickFolder(page);
  await expect(driveButton(page)).toHaveText('저장됨');
  const signIns = () => page.evaluate(() => document.documentElement.dataset.signIns);
  expect(await signIns()).toBe('1');

  // Fifty minutes later the token is in its renewal window.
  await page.clock.fastForward('50:00');
  await expect(driveButton(page)).toHaveText('연장');
  await canvas(page).click({ position: { x: 600, y: 400 } });
  await expect(driveButton(page)).toHaveText('저장됨');
  expect(await signIns()).toBe('2');

  // Without a click, access ends and saving waits for a reconnect.
  await page.clock.fastForward(60 * 60_000);
  await expect(driveButton(page)).toHaveText('다시 연결');
});

test('saving to a folder makes one file even when Drive’s answer is lost', async ({ page }) => {
  await mockGoogleScripts(page);
  const drive = await mockDrive(page);
  drive.faults.loseNextCreate = true;
  await fromFile(page, 'Drive 폴더에 저장…');
  await pickFolder(page);
  await expect(driveButton(page)).toHaveText('저장됨');
  expect([...drive.files.keys()]).toEqual(['created-1']);
  expect(drive.requests.filter((request) => request.startsWith('POST'))).toHaveLength(1);
});

test('tabs keep their own files: opening one in a tab leaves the other tab’s alone', async ({
  page,
  context,
}) => {
  await mockGoogleScripts(context);
  const drive = await mockDrive(context);
  await fromFile(page, 'Drive 폴더에 저장…');
  await pickFolder(page);
  await expect(driveButton(page)).toHaveText('저장됨');

  drive.files.set('shared', {
    name: 'Shared.stormlet',
    version: 7,
    parents: [],
    content: serializeBoard({ title: 'Shared', stickies: {} }),
  });
  const second = await context.newPage();
  await second.goto('/');
  await fromFile(second, 'Drive에서 열기…');
  await second.getByRole('dialog', { name: 'Stormlet 보드 열기' }).getByRole('button').click();
  await expect(second.getByRole('button', { name: '보드 이름: Shared' })).toBeVisible();
  await expect(page.getByRole('button', { name: '보드 이름: My idea board' })).toBeVisible();
  await expect(driveButton(page)).toHaveAttribute('title', /^My idea board\.stormlet/);

  // Each tab's edit goes to its own file.
  for (const [tab, text] of [
    [page, 'First tab'],
    [second, 'Second tab'],
  ] as const) {
    await canvas(tab).focus();
    await tab.keyboard.press('n');
    const at = await point(tab, 300, 300);
    await tab.mouse.click(at.x, at.y);
    await tab.keyboard.type(text);
    await tab.keyboard.press('Escape');
    await expect(driveButton(tab)).toHaveText('저장 중…');
    await expect(driveButton(tab)).toHaveText('저장됨');
  }
  const texts = (id: string) =>
    Object.values(parseBoard(drive.files.get(id)!.content).stickies).map((note) => note.text);
  expect([texts('created-1'), texts('shared')]).toEqual([['First tab'], ['Second tab']]);
});

test('a page closed before Drive answered a creation links that file after reconnecting', async ({
  page,
}) => {
  await mockGoogleScripts(page);
  const drive = await mockDrive(page);
  drive.faults.holdNextCreate = true;
  await fromFile(page, 'Drive 폴더에 저장…');
  await pickFolder(page);
  await expect.poll(() => drive.files.size).toBe(1);
  await page.reload();
  await expect(driveButton(page)).toHaveCount(0);

  await fromFile(page, 'Google Drive 연결');
  await expect(
    page.getByText(
      '페이지를 닫기 직전 Drive에 저장한 My idea board.stormlet을(를) 찾아 다시 연결했습니다.',
    ),
  ).toBeVisible();
  await expect(driveButton(page)).toHaveText('저장됨');
  expect([...drive.files.keys()]).toEqual(['created-1']);
  expect(drive.requests.filter((request) => request.startsWith('POST'))).toHaveLength(1);
});
