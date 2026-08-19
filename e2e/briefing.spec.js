const { test, expect } = require('@playwright/test');

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function mockTelegramProxy(page) {
  await page.route('https://r.jina.ai/**', async (route) => {
    const url = route.request().url();
    const match = url.match(/\/s\/([A-Za-z0-9_]+)/);
    const channel = match ? match[1] : 'unknown';
    await route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: `Telegram preview\nhttps://t.me/${channel}/999999\n시장 브리핑 테스트용 본문입니다. 충분한 길이의 문장을 넣어 새 원문 미리보기도 정상적으로 표시되도록 합니다.`,
    });
  });
}

test('globe → issue detail → source flow renders without browser errors', async ({ page }) => {
  const pageErrors = collectPageErrors(page);
  await page.goto('/');

  await expect(page.locator('#stat-issues')).toHaveText('15');
  await page.locator('#rg-us').click();
  await expect(page.locator('#pop')).toBeVisible();
  await expect(page.locator('#pop-region')).toHaveText('미국');

  const category = page.locator('.cat:not(.is-empty)').first();
  await category.click();
  const headline = page.locator('.head').first();
  await expect(headline).toBeVisible();
  await headline.click();

  await expect(page.locator('#detail')).toBeVisible();
  await expect(page.locator('.dt-facts li').first()).toBeVisible();
  await expect(page.locator('.dt-facts b').first()).toBeVisible();

  const sourceHead = page.locator('#detail .src-head').first();
  await sourceHead.click();
  await expect(page.locator('#detail .src-raw').first()).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('map → panel → card flow and feedback persistence work', async ({ page }) => {
  const pageErrors = collectPageErrors(page);
  await page.goto('/v1-map/index.html#map');

  await expect(page.locator('.nd-event')).toHaveCount(3);
  await page.locator('.nd-event').first().click();
  await expect(page.locator('#panel')).toBeVisible();
  await expect(page.locator('#panel .pn-facts b').first()).toBeVisible();
  await page.locator('#pn-close').click();

  await page.locator('[data-mode="toss"]').click();
  await expect(page.locator('.card')).toBeVisible();
  await expect(page.locator('#progress-text')).toHaveText('1 / 3');

  const termButton = page.locator('#card-area .know-btn').first();
  const termId = await termButton.getAttribute('data-term');
  await termButton.click();

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('briefing:feedback:down:v1') || '[]'));
  expect(stored).toContain(`term:${termId}`);

  await page.reload();
  await expect(page.locator('.card')).toBeVisible();
  const afterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('briefing:feedback:down:v1') || '[]'));
  expect(afterReload).toContain(`term:${termId}`);
  expect(pageErrors).toEqual([]);
});

test('mocked Telegram refresh advances cursor and does not rediscover the same posts', async ({ page }) => {
  const pageErrors = collectPageErrors(page);
  await mockTelegramProxy(page);
  await page.goto('/');

  await page.locator('#btn-refresh').click();
  await expect(page.locator('#rf-note')).toContainText('확인 완료', { timeout: 15_000 });
  await expect(page.locator('#rf-note')).toContainText('새 글 7건');

  const cursors = await page.evaluate(() => JSON.parse(localStorage.getItem('briefing:telegram-cursors:v1') || '{}'));
  expect(Object.keys(cursors)).toHaveLength(7);
  expect(Object.values(cursors).every((value) => value === 999999)).toBeTruthy();

  await page.locator('#rf-close').click();
  await page.locator('#btn-refresh').click();
  await expect(page.locator('#rf-note')).toContainText('확인 완료', { timeout: 15_000 });
  await expect(page.locator('#rf-note')).toContainText('새 글 0건');

  expect(pageErrors).toEqual([]);
});
