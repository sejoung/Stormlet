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
