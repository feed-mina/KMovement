import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    testMatch: /community-visual-check\.test\.ts/,
    timeout: 120_000,
    fullyParallel: false,
    workers: 1,
    reporter: [['line']],
    use: {
        baseURL: 'http://localhost:3000',
        ...devices['Desktop Chrome'],
        screenshot: 'off',
        video: 'off',
        trace: 'off',
    },
});
