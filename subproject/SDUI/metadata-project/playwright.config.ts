import { defineConfig, devices } from '@playwright/test';

/**
 * 프로젝트 메모: Next.js(3000포트)와 Spring Boot(8080포트 가정) 연동 환경 설정 [cite: 2026-02-17]
 */
export default defineConfig({
    testDir: './tests', // 테스트 파일이 저장된 상위 경로
    fullyParallel: true,   // 테스트 병렬 실행 여부
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',      // 테스트 결과 보고서 형식

    use: {
        /* 프론트엔드 기본 URL 설정 [cite: 2026-02-17] */
        baseURL: process.env.BASE_URL || 'http://localhost:3000',
        /* 테스트 실패 시 스크린샷 캡처  */
        screenshot: 'only-on-failure',
        /* 테스트 실패 시 비디오 녹화  */
        video: 'retain-on-failure',
        /* 트레이스(네트워크, 콘솔 로그 등) 상세 기록  */
        trace: 'retain-on-failure',
    },

    /* 테스트 실행 전 로컬 서버 자동 시작 설정 (선택 사항) */
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },

    projects: [
        {
            name: 'setup',
            testMatch: /auth\.setup\.ts/,
        },
        {
            name: 'chromium',
            testMatch: /e2e\/.*\.test\.ts/, // E2E 폴더 내 파일만 실행
            use: {
                ...devices['Desktop Chrome'],
                // 인증 상태 적용
                storageState: 'playwright/.auth/user.json',
            },
            dependencies: ['setup'],
        },
    ],
});
