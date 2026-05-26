import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const screenshotDir = path.resolve(process.cwd(), '..', '..', '..', '.ai', 'screenshots');
const sampleSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
  <rect width="640" height="360" fill="#0f8b8d"/>
  <circle cx="508" cy="112" r="72" fill="#f7c948"/>
  <text x="48" y="200" fill="white" font-size="44" font-family="Arial">Upload Preview</text>
</svg>`;

test.beforeAll(() => {
    fs.mkdirSync(screenshotDir, { recursive: true });
});

test.beforeEach(async ({ page }) => {
    page.on('dialog', async (dialog) => {
        console.log(`dialog: ${dialog.message()}`);
        await dialog.dismiss();
    });
});

test('community list and detail render backend image data', async ({ page }) => {
    await page.goto('/view/COMMUNITY_LIST', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('[Codex Test] Community image post')).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('.community-thumb img')).toHaveCount(1);
    await page.screenshot({
        path: path.join(screenshotDir, 'community-list-playwright.png'),
        fullPage: true,
    });

    await page.goto('/view/COMMUNITY_DETAIL/1', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Image attached for image-to-video AI preview test.')).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('.community-detail-image img')).toHaveCount(1);
    await page.screenshot({
        path: path.join(screenshotDir, 'community-detail-playwright.png'),
        fullPage: true,
    });
});

test('community write and modify forms show image upload controls', async ({ page }) => {
    await page.route('**/api/auth/me', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                isLoggedIn: true,
                userSqno: 62,
                userId: 'user_test1',
                email: 'user1@test.com',
                role: 'ROLE_USER',
            }),
        });
    });

    await page.goto('/view/COMMUNITY_WRITE', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#community-title')).toBeVisible({ timeout: 45_000 });
    await page.getByRole('button', { name: '스케치하기' }).click();
    await expect(page.getByRole('dialog', { name: '스케치 도구' })).toBeVisible();
    await expect(page.locator('.community-sketch-canvas')).toBeVisible();
    await page.getByRole('button', { name: '닫기' }).click();
    await page.fill('#community-title', 'Visual upload test');
    await page.fill('#community-content', 'Preview image before sending to image-to-video AI.');
    await page.setInputFiles('#community-images', {
        name: 'ai-video-source.svg',
        mimeType: 'image/svg+xml',
        buffer: Buffer.from(sampleSvg),
    });
    await expect(page.locator('.community-image-tile img')).toHaveCount(1);
    await page.screenshot({
        path: path.join(screenshotDir, 'community-write-upload-preview.png'),
        fullPage: true,
    });

    await page.goto('/view/COMMUNITY_MODIFY/1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#community-title')).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('.community-image-tile img')).toHaveCount(1);
    await page.screenshot({
        path: path.join(screenshotDir, 'community-modify-retained-image.png'),
        fullPage: true,
    });
});
