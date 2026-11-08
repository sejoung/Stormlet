import { test, expect, canvas, point } from './support';
import { mockDrive, mockGoogleScripts } from './google';
import { serializeBoard } from '../../src/adapters/files/stormlet-format';
import { parseBoard } from '../../src/adapters/files/stormlet-format';

const driveButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /^Google Drive:/ });

async function connect(page: import('@playwright/test').Page) {
  await driveButton(page).click();
  const dialog = page.getByRole('dialog', { name: 'Google Drive' });
  await dialog.getByRole('button', { name: 'Google Drive 연결' }).click();
  await expect(dialog.getByRole('button', { name: 'Drive 폴더에 저장…' })).toBeVisible();
  return dialog;
}

test('saves to a Drive folder, autosaves edits and merges changes made elsewhere after reconnecting', async ({
  page,
}) => {
  await mockGoogleScripts(page);
  const drive = await mockDrive(page);
  const dialog = await connect(page);
  await dialog.getByRole('button', { name: 'Drive 폴더에 저장…' }).click();
  await page
    .getByRole('dialog', { name: '이 보드를 저장할 폴더 선택' })
    .getByRole('button')
    .click();
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
  const dialog = await connect(page);
  await dialog.getByRole('button', { name: 'Drive에서 열기…' }).click();
  await page.getByRole('dialog', { name: 'Stormlet 보드 열기' }).getByRole('button').click();
  await expect(page.getByText('Drive에서 Shared.stormlet을(를) 열었습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '보드 이름: Shared' })).toBeVisible();
  await expect(page.getByRole('button', { name: /: From Drive$/ })).toBeVisible();
  await expect(driveButton(page)).toHaveText('저장됨');
  expect(drive.requests.filter((request) => request.startsWith('PATCH'))).toEqual([]);
});

test('a new tab takes over an open tab’s connection, and a disconnect ends both', async ({
  page,
  context,
}) => {
  await mockGoogleScripts(context);
  const drive = await mockDrive(context);
  const dialog = await connect(page);
  await dialog.getByRole('button', { name: 'Drive 폴더에 저장…' }).click();
  await page
    .getByRole('dialog', { name: '이 보드를 저장할 폴더 선택' })
    .getByRole('button')
    .click();
  await expect(driveButton(page)).toHaveText('저장됨');

  const second = await context.newPage();
  await second.goto('/');
  // The open tab hands over its token: no sign-in popup and nothing stored.
  await expect(driveButton(second)).toHaveText('저장됨');
  expect(await second.evaluate(() => document.documentElement.dataset.signIns)).toBeUndefined();
  expect(
    await second.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain('e2e-token');
  expect(drive.requests.filter((request) => request.startsWith('PATCH'))).toEqual([]);

  await driveButton(second).click();
  await second
    .getByRole('dialog', { name: 'Google Drive' })
    .getByRole('button', { name: 'Google Drive 연결 해제' })
    .click();
  await expect(driveButton(second)).toHaveText('Drive');
  await expect(driveButton(page)).toHaveText('Drive');
});

test('renews access on a click before it runs out', async ({ page }) => {
  await page.clock.install();
  await page.reload();
  await mockGoogleScripts(page);
  await mockDrive(page);
  const dialog = await connect(page);
  await dialog.getByRole('button', { name: 'Drive 폴더에 저장…' }).click();
  await page
    .getByRole('dialog', { name: '이 보드를 저장할 폴더 선택' })
    .getByRole('button')
    .click();
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
  const dialog = await connect(page);
  drive.faults.loseNextCreate = true;
  await dialog.getByRole('button', { name: 'Drive 폴더에 저장…' }).click();
  await page
    .getByRole('dialog', { name: '이 보드를 저장할 폴더 선택' })
    .getByRole('button')
    .click();
  await expect(driveButton(page)).toHaveText('저장됨');
  expect([...drive.files.keys()]).toEqual(['created-1']);
  expect(drive.requests.filter((request) => request.startsWith('POST'))).toHaveLength(1);
});

test('an open tab follows the file another tab opens, and saves its edits there', async ({
  page,
  context,
}) => {
  await mockGoogleScripts(context);
  const drive = await mockDrive(context);
  const dialog = await connect(page);
  await dialog.getByRole('button', { name: 'Drive 폴더에 저장…' }).click();
  await page
    .getByRole('dialog', { name: '이 보드를 저장할 폴더 선택' })
    .getByRole('button')
    .click();
  await expect(driveButton(page)).toHaveText('저장됨');
  const second = await context.newPage();
  await second.goto('/');
  await expect(driveButton(second)).toHaveText('저장됨');

  drive.files.set('shared', {
    name: 'Shared.stormlet',
    version: 7,
    parents: [],
    content: serializeBoard({ title: 'Shared', stickies: {} }),
  });
  await driveButton(page).click();
  await page
    .getByRole('dialog', { name: 'Google Drive' })
    .getByRole('button', { name: 'Drive에서 열기…' })
    .click();
  await page.getByRole('dialog', { name: 'Stormlet 보드 열기' }).getByRole('button').click();
  await expect(second.getByRole('button', { name: '보드 이름: Shared' })).toBeVisible();

  // The other tab's edit goes to the file it now follows, not the one it started with.
  const before = drive.files.get('created-1')!.version;
  await canvas(second).focus();
  await second.keyboard.press('n');
  const at = await point(second, 300, 300);
  await second.mouse.click(at.x, at.y);
  await second.keyboard.type('Second tab');
  await second.keyboard.press('Escape');
  await expect(driveButton(second)).toHaveText('저장 중…');
  await expect(driveButton(second)).toHaveText('저장됨');
  const shared = parseBoard(drive.files.get('shared')!.content);
  expect(Object.values(shared.stickies).map((note) => note.text)).toEqual(['Second tab']);
  expect(drive.files.get('created-1')!.version).toBe(before);
});

test('a page closed before Drive answered a creation links that file after reconnecting', async ({
  page,
}) => {
  await mockGoogleScripts(page);
  const drive = await mockDrive(page);
  const dialog = await connect(page);
  drive.faults.holdNextCreate = true;
  await dialog.getByRole('button', { name: 'Drive 폴더에 저장…' }).click();
  await page
    .getByRole('dialog', { name: '이 보드를 저장할 폴더 선택' })
    .getByRole('button')
    .click();
  await expect.poll(() => drive.files.size).toBe(1);
  await page.reload();
  await expect(driveButton(page)).toHaveText('Drive');

  // The dialog may already show the linked file when the lookup is quick, so only connect.
  await driveButton(page).click();
  await page
    .getByRole('dialog', { name: 'Google Drive' })
    .getByRole('button', { name: 'Google Drive 연결' })
    .click();
  await expect(
    page.getByText(
      '페이지를 닫기 직전 Drive에 저장한 My idea board.stormlet을(를) 찾아 다시 연결했습니다.',
    ),
  ).toBeVisible();
  await expect(driveButton(page)).toHaveText('저장됨');
  expect([...drive.files.keys()]).toEqual(['created-1']);
  expect(drive.requests.filter((request) => request.startsWith('POST'))).toHaveLength(1);
});
