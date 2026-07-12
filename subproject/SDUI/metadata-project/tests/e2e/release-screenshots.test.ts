import { test, expect } from '@playwright/test';

/**
 * Release QA evidence capture.
 * Run with a signed-in Playwright storage state and BASE_URL pointing at the
 * deployed preview. These screenshots are intentionally opt-in and are not
 * part of the default CI suite.
 */
test.describe('release screen evidence', () => {
  test.skip(!process.env.RELEASE_SCREENSHOTS, 'Set RELEASE_SCREENSHOTS=1 to capture QA evidence');

  for (const path of ['/view/FOCUS', '/view/CONTENT_WRITE', '/view/MY_PAGE']) {
    test(`captures ${path}`, async ({ page }, testInfo) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      await expect(page.locator('body')).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${path.replaceAll('/', '_').slice(1)}.png`), fullPage: true });
    });
  }
});
