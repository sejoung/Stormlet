import { test, expect, type Locator, type Page } from '@playwright/test';
import { en } from '../../src/i18n/locales/en';
import { ko } from '../../src/i18n/locales/ko';
import { serializeBoard } from '../../src/adapters/files/stormlet-format';
import type { Board } from '../../src/domain/model';
import { mockDrive, mockGoogleScripts } from '../e2e/drive/google';
import { layoutBoard, layoutText, otherBoard, sampleBoard, sampleText } from './sample';

type Lang = 'ko' | 'en';
const shot = (lang: Lang, name: string) => `public/manual/images/${lang}/${name}.png`;

/** The union of the boxes of `parts`, grown by `pad`, kept inside the page. */
async function around(page: Page, parts: Locator[], pad = 16) {
  const boxes = await Promise.all(parts.map((part) => part.boundingBox()));
  const shown = boxes.filter((box) => box !== null);
  const left = Math.max(0, Math.min(...shown.map((box) => box.x)) - pad);
  const top = Math.max(0, Math.min(...shown.map((box) => box.y)) - pad);
  const right = Math.min(
    page.viewportSize()!.width,
    Math.max(...shown.map((b) => b.x + b.width)) + pad,
  );
  const bottom = Math.min(
    page.viewportSize()!.height,
    Math.max(...shown.map((b) => b.y + b.height)) + pad,
  );
  return { x: left, y: top, width: right - left, height: bottom - top };
}

async function openFile(page: Page, board: Board, name: string) {
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(serializeBoard(board)),
  });
}

test('captures the user guide', async ({ page, context }, info) => {
  const lang = info.project.name as Lang;
  const m = lang === 'ko' ? ko : en;
  const menu = (name: string) => page.getByRole('button', { name, exact: true });
  const item = (name: string) => page.getByRole('menuitem', { name, exact: true });
  const dialog = (name: string) => page.getByRole('dialog', { name });
  const toolbar = page.locator('.toolbar');
  await mockGoogleScripts(context);
  const drive = await mockDrive(context);

  await page.goto('/');
  await openFile(page, sampleBoard(lang), 'retro.stormlet');
  await expect(page.getByText(sampleText(lang))).toBeVisible();
  await page.keyboard.press('Escape');
  await toolbar.screenshot({ path: shot(lang, 'toolbar-local') });

  // Connect and save to a Drive folder.
  const connect = page.getByRole('button', { name: m['drive.connect'] });
  await connect.hover();
  await page.waitForTimeout(300);
  await connect.click();
  await page.getByRole('button', { name: m['drive.saveHere'] }).click();
  await dialog(m['drive.pickFolder']).getByRole('button').click();
  await expect(page.getByRole('button', { name: /^Google Drive:/ })).toHaveText(
    m['drive.short.synced'],
  );
  await page.mouse.move(640, 700);
  await page.waitForTimeout(400);
  await toolbar.screenshot({ path: shot(lang, 'toolbar-drive') });

  // The whole editor, fitted to the board, with the minimap open and no passing message.
  await menu(m['menu.view']).click();
  await page.getByRole('menuitemcheckbox', { name: m['chrome.minimap'] }).click();
  await menu(m['menu.view']).click();
  await item(m['chrome.fit']).click();
  await page.mouse.move(640, 700);
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 8000 });
  await page.screenshot({ path: shot(lang, 'overview') });

  // A selected note, and its menu.
  const note = page.getByText(sampleText(lang));
  await note.click();
  await page.waitForTimeout(200);
  await page.screenshot({
    path: shot(lang, 'note-selected'),
    clip: await around(page, [note, page.locator('.selection-toolbar')], 24),
  });
  await note.click({ button: 'right' });
  const noteMenu = page.getByRole('menu');
  await expect(noteMenu).toBeVisible();
  await page.screenshot({
    path: shot(lang, 'note-menu'),
    clip: await around(page, [note, noteMenu]),
  });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // The menus.
  for (const [name, file] of [
    [m['menu.file'], 'menu-file'],
    [m['menu.edit'], 'menu-edit'],
    [m['menu.view'], 'menu-view'],
    [m['toolbar.settings'], 'menu-settings'],
  ] as const) {
    await menu(name).click();
    const list = page.getByRole('menu', { name });
    await expect(list).toBeVisible();
    await page.screenshot({ path: shot(lang, file), clip: await around(page, [menu(name), list]) });
    await page.keyboard.press('Escape');
  }

  // Dialogs: shortcuts, new board, recent boards, disconnect.
  await menu(m['toolbar.settings']).click();
  await item(m['chrome.shortcuts']).click();
  await dialog(m['help.title']).screenshot({ path: shot(lang, 'dialog-help') });
  await page.keyboard.press('Escape');

  await menu(m['menu.file']).click();
  await item(m['menu.newBoard']).click();
  await dialog(m['newBoard.title']).screenshot({ path: shot(lang, 'dialog-new-board') });
  await page.keyboard.press('Escape');

  const earlier = await context.newPage();
  await earlier.goto('/');
  await openFile(earlier, otherBoard(lang), 'plan.stormlet');
  await expect(earlier.getByText(otherBoard(lang).stickies.o0.text)).toBeVisible();
  await earlier.waitForTimeout(400);
  await earlier.close();
  await menu(m['menu.file']).click();
  await item(m['menu.recentBoards']).click();
  await expect(dialog(m['recent.title']).getByRole('listitem')).toHaveCount(1);
  await dialog(m['recent.title']).screenshot({ path: shot(lang, 'dialog-recent') });
  await page.keyboard.press('Escape');

  await menu(m['menu.file']).click();
  await item(m['menu.disconnect']).click();
  await dialog(m['disconnect.title']).screenshot({ path: shot(lang, 'dialog-disconnect') });
  await page.keyboard.press('Escape');

  // A conflict: the same note changed here and in Drive.
  const [id, stored] = [...drive.files][0];
  const remote = JSON.parse(stored.content) as { stickies: { id: string; text: string }[] };
  const target = remote.stickies.find((s) => s.text === sampleText(lang))!;
  target.text = lang === 'ko' ? '테스트 환경을 새로 구성함' : 'Rebuilt the test environment';
  Object.assign(drive.files.get(id)!, {
    content: JSON.stringify(remote),
    version: stored.version + 1,
  });
  await note.dblclick();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(
    lang === 'ko' ? '테스트 환경 담당자 지정' : 'Assign an owner for testing',
  );
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  const status = page.getByRole('button', { name: /^Google Drive:/ });
  await expect(status).toHaveText(m['drive.short.conflict'], { timeout: 15_000 });
  await status.click();
  await dialog(m['drive.conflict.title']).screenshot({ path: shot(lang, 'dialog-conflict') });

  await captureLayout(await context.newPage(), lang);
});

/** Placing, resizing and arranging notes, on a board of its own in a new tab. */
async function captureLayout(page: Page, lang: Lang) {
  const m = lang === 'ko' ? ko : en;
  await page.goto('/');
  await openFile(page, layoutBoard(lang), 'ideas.stormlet');
  const notes = [0, 1, 2, 3].map((index) => page.getByText(layoutText(lang, index)));
  await expect(notes[0]).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: m['menu.view'], exact: true }).click();
  await page.getByRole('menuitem', { name: m['chrome.fit'], exact: true }).click();
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 8000 });
  const box = async (index: number) =>
    (await notes[index].locator('xpath=ancestor::*[@data-sticky-id]').boundingBox())!;

  // Dragging the third note up beside the first two: equal-gap and edge guides appear.
  const [a, b, c] = [await box(0), await box(1), await box(2)];
  const gap = b.x - a.x - a.width;
  await page.mouse.move(c.x + 20, c.y + 20);
  await page.mouse.down();
  await page.mouse.move(c.x + 60, c.y - 40, { steps: 4 });
  await page.mouse.move(b.x + b.width + gap + 22, a.y + 21, { steps: 6 });
  await page.waitForTimeout(150);
  await page.screenshot({
    path: shot(lang, 'layout-spacing'),
    clip: await around(page, notes.slice(0, 3), 32),
  });
  await page.mouse.up();

  // Resizing the narrow note: it snaps to its neighbour's width and both get a marker.
  await notes[3].click();
  const handle = page.locator('.sticky.is-selected .handle-se');
  const start = (await handle.boundingBox())!;
  const target = (await box(0)).x + (await box(0)).width;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(target - 3, start.y + 20, { steps: 6 });
  await page.waitForTimeout(150);
  await page.screenshot({
    path: shot(lang, 'layout-resize'),
    clip: await around(page, [notes[0], notes[3], page.locator('.size-badge')], 28),
  });
  await page.mouse.up();

  // Everything selected: the arrange icons appear under the selection toolbar.
  await page.keyboard.press('Escape');
  await page.locator('.board').focus();
  await page.keyboard.press('ControlOrMeta+a');
  const arrange = page.locator('.arrange-toolbar');
  await expect(arrange).toBeVisible();
  await page.screenshot({
    path: shot(lang, 'layout-arrange'),
    clip: await around(page, [...notes, page.locator('.selection-anchor')], 20),
  });

  // The Arrange menu, with the selection still in place so its commands are enabled.
  const arrangeMenu = page.getByRole('button', { name: m['menu.arrange'], exact: true });
  await arrangeMenu.click();
  const list = page.getByRole('menu', { name: m['menu.arrange'] });
  await expect(list).toBeVisible();
  await page.screenshot({
    path: shot(lang, 'menu-arrange'),
    clip: await around(page, [arrangeMenu, list]),
  });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // Dragging a colour out of the sticky tool's flyout onto the board.
  await page.getByRole('button', { name: m['creation.sticky'] }).click();
  const flyout = page.getByRole('dialog', { name: m['creation.stickyDefaults'] });
  const swatch = flyout.getByRole('button', {
    name: m['creation.stickyColor'].replace('{color}', m['noteColor.green']),
  });
  const from = (await swatch.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 180, from.y + 90, { steps: 8 });
  await page.waitForTimeout(150);
  await page.screenshot({
    path: shot(lang, 'palette-drag'),
    // The header and swatches only: the hint below scrolls inside the flyout at this height.
    clip: await around(
      page,
      [
        flyout.locator('header'),
        flyout.locator('.default-color-grid'),
        page.locator('.swatch-ghost'),
      ],
      24,
    ),
  });
  await page.mouse.up();
  await page.close();
}
