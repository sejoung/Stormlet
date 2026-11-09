import { readFile } from 'node:fs/promises';
import {
  test,
  expect,
  canvas,
  point,
  saved,
  openBoard,
  note,
  frame,
  drag,
  screenshot,
  rightClick,
} from '../support';

test('creates text, edits multiline content and applies whole-box formatting', async ({ page }) => {
  await canvas(page).focus();
  await page.keyboard.press('t');
  await expect(page.getByRole('button', { name: '텍스트 도구' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await canvas(page).click({ position: { x: 340, y: 250 } });
  const input = page.getByRole('textbox', { name: '텍스트 내용' });
  await expect(input).toBeFocused();
  await input.fill('회의 제목');
  await input.press('Enter');
  await page.keyboard.insertText('설명을 적습니다');
  await expect(input).toHaveValue('회의 제목\n설명을 적습니다');
  await input.press('Control+Enter');
  const text = page.locator('.sticky.is-text');
  await expect(text).toHaveCount(1);
  await expect(text).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect
    .poll(() => text.evaluate((element) => getComputedStyle(element, '::after').content))
    .toBe('none');
  await expect(text.locator('p')).toHaveCSS('text-align', 'left');
  await expect(page.getByRole('combobox', { name: '글자 크기' })).toHaveValue('auto');
  await expect
    .poll(() => text.locator('p').evaluate((node) => parseFloat(getComputedStyle(node).fontSize)))
    .toBeGreaterThan(24);
  const toolbar = page.getByRole('toolbar', { name: '텍스트 편집 도구' });
  await toolbar.getByRole('button', { name: '굵게' }).click();
  await toolbar.getByRole('button', { name: '기울임' }).click();
  await toolbar.getByRole('button', { name: '밑줄' }).click();
  await toolbar.getByRole('combobox', { name: '글자 크기' }).selectOption('32');
  await toolbar.getByRole('button', { name: '글자 색상' }).click();
  await page.getByRole('button', { name: '글자 색상: 파랑' }).click();
  await toolbar.getByRole('button', { name: '텍스트 정렬' }).click();
  await page.getByRole('button', { name: '오른쪽', exact: true }).click();
  await canvas(page).click({ position: { x: 950, y: 650 } });
  await expect(text).toHaveCSS('box-shadow', 'none');
  await expect
    .poll(async () => (await saved(page)).stickies[0])
    .toMatchObject({
      objectType: 'text',
      text: '회의 제목\n설명을 적습니다',
      bold: true,
      italic: true,
      underline: true,
      fontSize: 32,
      textColor: 'blue',
      textAlign: 'right',
    });
  await page.reload();
  await expect(text.locator('p')).toHaveCSS('text-align', 'right');
  await expect(text).toHaveCSS('color', 'rgb(66, 98, 232)');
  await text.dblclick();
  await expect(input).toHaveValue('회의 제목\n설명을 적습니다');
  await input.fill('변경한 설명');
  await input.press('Escape');
  await page.getByRole('button', { name: '실행 취소', exact: true }).click();
  await expect(text.locator('p')).toHaveText('회의 제목\n설명을 적습니다');
});

test('adds text from the canvas menu, edits with one text-tool click and removes blank text', async ({
  page,
}) => {
  const at = await point(page, 340, 240);
  const menu = await rightClick(page, at);
  await menu.getByRole('menuitem', { name: '텍스트 추가 T' }).click();
  const input = page.getByRole('textbox', { name: '텍스트 내용' });
  await input.fill('제목');
  await input.press('Escape');
  const text = page.locator('.sticky.is-text');
  await page.getByRole('button', { name: '텍스트 도구' }).click();
  await text.click();
  await expect(input).toBeFocused();
  await input.fill('');
  await input.press('Escape');
  await expect(text).toHaveCount(0);
  await expect.poll(async () => (await saved(page)).stickies.length).toBe(0);
});

test('moves, resizes, copies and locks text while preserving its identity', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openBoard(page, {
    stickies: {
      title: {
        ...note('title', 300, 230, '텍스트와 포스트잇'),
        objectType: 'text',
        width: 320,
        height: 100,
        textColor: 'purple',
        textAlign: 'left',
        autoFont: false,
        fontSize: 24,
      },
    },
  });
  const text = page.locator('[data-sticky-id="title"]');
  const start = await text.boundingBox();
  await drag(
    page,
    { x: start!.x + 70, y: start!.y + 35 },
    { x: start!.x + 190, y: start!.y + 115 },
  );
  await expect.poll(async () => (await saved(page)).stickies[0].x).toBe(420);
  const handle = text.locator('.handle-se');
  await handle.press('ArrowRight');
  await handle.press('ArrowDown');
  await expect
    .poll(async () => (await saved(page)).stickies[0])
    .toMatchObject({ width: 340, height: 120 });
  await text.focus();
  await page.keyboard.press('ControlOrMeta+c');
  await canvas(page).click({ position: { x: 950, y: 550 } });
  await page.keyboard.press('ControlOrMeta+v');
  await expect(page.locator('.is-text')).toHaveCount(2);
  const copies = (await saved(page)).stickies;
  expect(copies.every((item) => item.objectType === 'text' && item.textColor === 'purple')).toBe(
    true,
  );
  await page.getByRole('button', { name: '텍스트 잠금' }).click();
  await page.keyboard.press('Delete');
  await expect(page.locator('.is-text')).toHaveCount(2);
  await expect
    .poll(async () => (await saved(page)).stickies.filter((item) => item.locked).length)
    .toBe(1);
});

test('renders text in light, dark and narrow layouts and exports it without paper', async ({
  page,
}, info) => {
  await openBoard(page, {
    stickies: {
      title: {
        ...note('title', 200, 100, '팀 회고'),
        objectType: 'text',
        width: 440,
        height: 100,
        fontSize: 48,
        autoFont: false,
        bold: true,
      },
      description: {
        ...note(
          'description',
          200,
          210,
          '잘된 점과 다음에 시도할 일을 정리해요.\nEnter로 여러 줄을 쓸 수 있어요.',
        ),
        objectType: 'text',
        width: 620,
        height: 120,
        textColor: 'blue',
        fontSize: 24,
        autoFont: false,
      },
      a: { ...note('a', 220, 400, '작은 변경을\n빠르게 배포'), color: 'green' },
      b: { ...note('b', 430, 400, '코드 리뷰\n시간 줄이기'), color: 'yellow' },
    },
    frames: { f: frame('f', 'Ideas', 180, 350, 650, 270) },
  });
  const title = page.locator('[data-sticky-id="title"]');
  await expect(title).toHaveCSS('color', 'rgb(35, 36, 54)');
  await screenshot(page, info, 'text-light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(title).toHaveCSS('color', 'rgb(241, 241, 247)');
  await screenshot(page, info, 'text-dark');
  await page.getByRole('button', { name: '파일', exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'SVG 이미지로 내보내기' }).click(),
  ]);
  const svg = await readFile((await download.path())!, 'utf8');
  expect(svg).toContain('팀 회고');
  expect(svg).toContain('fill="#232436"');
  expect(svg.match(/filter="url\(#note-shadow\)"/g)).toHaveLength(2);
  await download.saveAs(info.outputPath('text-board.svg'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '모든 메모 보기', exact: true }).click();
  await expect(page.getByRole('button', { name: '텍스트 도구' })).toBeVisible();
  await title.click();
  await expect(page.getByRole('toolbar', { name: '텍스트 편집 도구' })).toBeVisible();
  await screenshot(page, info, 'text-narrow');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
