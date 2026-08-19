const { test, expect } = require('@playwright/test');

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function mockRefreshApi(page, { withGeneratedItem = false } = {}) {
  let calls = 0;
  await page.route('**/api/refresh', async (route) => {
    calls += 1;
    const first = calls === 1;
    const rows = ['yieldnspread', 'deandatbond', 'hanwhastrategy', 'redbirdstock', 'daishinstrategy', 'aetherjapanresearch', 'rafikiresearch']
      .map((id) => ({ id, name: id, ok: true, count: first ? 1 : 0, preview: first ? '새 원문 테스트 본문' : '' }));
    const items = first && withGeneratedItem ? [{
      id: 'generated-test',
      region: 'eu',
      cat: 'rate',
      imp: 2,
      tag: '유럽 · 금리',
      short: '테스트 새 이슈',
      title: '새로고침으로 생성된 유럽 테스트 이슈예요',
      metric: { value: '2.0%', dir: 'flat', sub: '테스트 지표' },
      facts: ['원문에 있는 <b>테스트 사실</b>이에요.'],
      note: '',
      sources: ['yieldnspread/999999'],
      terms: [{ id: 'generated-term', name: '테스트 용어', full: '테스트 용어', desc: '테스트 설명입니다.' }],
      notes: ['테스트 배경 설명입니다.'],
      opinion: '테스트 이슈의 맥락을 보여줘요.',
    }] : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        processed: true,
        llmConfigured: true,
        rows,
        cursors: Object.fromEntries(rows.map((row) => [row.id, 999999])),
        sources: first ? {
          'yieldnspread/999999': { ch: 'yieldnspread', id: 999999, at: '2026-08-19T06:00:00Z', text: '테스트 원문' },
        } : {},
        items,
      }),
    });
  });
}

test('globe → issue detail → source flow renders without browser errors', async ({ page }) => {
  const pageErrors = collectPageErrors(page);
  await page.goto('/');

  await expect(page.locator('#stat-issues')).toHaveText('15');
  await expect(page.locator('#rg-eu')).toBeVisible();
  await expect(page.locator('#rg-eu .rg-name')).toHaveText('유럽');

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

  await page.goto('/v1-map/index.html#card');
  await expect(page.locator('.card')).toBeVisible();
  const afterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('briefing:feedback:down:v1') || '[]'));
  expect(afterReload).toContain(`term:${termId}`);
  expect(pageErrors).toEqual([]);
});

test('on-demand refresh keeps status panel closed and advances cursor', async ({ page }) => {
  const pageErrors = collectPageErrors(page);
  await mockRefreshApi(page);
  await page.goto('/');

  await expect(page.locator('#rf')).toBeHidden();
  await page.locator('#btn-refresh').click();
  await expect(page.locator('#rf')).toBeHidden();
  await expect(page.locator('#toast')).toContainText('새 원문 7건', { timeout: 15_000 });

  const cursors = await page.evaluate(() => JSON.parse(localStorage.getItem('briefing:telegram-cursors:v1') || '{}'));
  expect(Object.keys(cursors)).toHaveLength(7);
  expect(Object.values(cursors).every((value) => value === 999999)).toBeTruthy();

  await page.locator('#btn-refresh').click();
  await expect(page.locator('#rf')).toBeHidden();
  await expect(page.locator('#toast')).toContainText('새로 올라온 글이 없어요', { timeout: 15_000 });
  expect(pageErrors).toEqual([]);
});

test('generated Europe refresh item persists and appears on globe after reload', async ({ page }) => {
  const pageErrors = collectPageErrors(page);
  await mockRefreshApi(page, { withGeneratedItem: true });
  await page.goto('/');
  await page.locator('#btn-refresh').click();

  await expect(page.locator('#stat-issues')).toHaveText('16', { timeout: 15_000 });
  await expect(page.locator('#rf')).toBeHidden();

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('briefing:generated:v1') || '{}'));
  expect(stored.items.some((item) => item.id === 'generated-test' && item.region === 'eu')).toBeTruthy();

  await page.locator('#rg-eu').click();
  await page.locator('.cat[data-cat="rate"]').click();
  await expect(page.getByText('새로고침으로 생성된 유럽 테스트 이슈예요')).toBeVisible();
  expect(pageErrors).toEqual([]);
});
