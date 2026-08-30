const { test, expect } = require('@playwright/test');

for (const viewport of [
  { width: 390, height: 844, name: '390x844' },
  { width: 320, height: 700, name: '320x700' },
]) {
  test(`mobile globe issue sheet fits the visible viewport at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');

    const regions = page.locator('.rg');
    await expect(regions.first()).toBeVisible();

    const count = await regions.count();
    let target = null;
    for (let i = 0; i < count; i += 1) {
      const row = regions.nth(i);
      const issueCount = Number((await row.locator('.rg-count').textContent()) || 0);
      if (issueCount > 0) {
        target = row;
        break;
      }
    }

    expect(target, 'at least one region should have current issues').not.toBeNull();
    await target.click();

    const pop = page.locator('#pop');
    const heads = page.locator('#heads');
    const firstHead = page.locator('#heads .head').first();
    await expect(pop).toBeVisible();
    await expect(firstHead).toBeVisible();

    const metrics = await page.evaluate(() => {
      const pop = document.querySelector('#pop').getBoundingClientRect();
      const heads = document.querySelector('#heads').getBoundingClientRect();
      const first = document.querySelector('#heads .head').getBoundingClientRect();
      return {
        innerHeight: window.innerHeight,
        popTop: pop.top,
        popBottom: pop.bottom,
        headsTop: heads.top,
        headsBottom: heads.bottom,
        firstTop: first.top,
        firstBottom: first.bottom,
      };
    });

    expect(metrics.popTop).toBeGreaterThanOrEqual(-1);
    expect(metrics.popBottom).toBeLessThanOrEqual(metrics.innerHeight + 1);
    expect(metrics.headsTop).toBeGreaterThanOrEqual(metrics.popTop - 1);
    expect(metrics.headsBottom).toBeLessThanOrEqual(metrics.popBottom + 1);
    expect(metrics.firstTop).toBeGreaterThanOrEqual(metrics.headsTop - 1);
    expect(metrics.firstBottom).toBeLessThanOrEqual(metrics.headsBottom + 1);
  });
}
