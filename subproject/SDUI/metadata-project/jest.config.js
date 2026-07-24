// jest.config.js
module.exports = {
    testEnvironment: 'jsdom',
    watchman: false,
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

    transformIgnorePatterns: [
        "/node_modules/(?!(swiper|ssr-window|dom7|until-async|msw|@mswjs)/)"
    ],

    transform: {
        '^.+\\.(t|j)sx?$|\\.mjs$': ['@swc/jest'],
    },
// @@@@ JSON 파일을 모듈로 인식할 수 있게 확장자 순서 확인
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    // @@@@ Jest에게 .mjs를 ESM으로 처리하라고 알려줌
    extensionsToTreatAsEsm: ['.ts', '.tsx'],
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '^swiper/css/(.*)$': 'identity-obj-proxy',
        '^@/(.*)$': '<rootDir>/$1',
        '^msw$': '<rootDir>/node_modules/msw',
        '^swiper/react$': '<rootDir>/node_modules/swiper/swiper-react.mjs',
        '^swiper/css$': 'identity-obj-proxy',
    },

    testEnvironmentOptions: {
        customExportConditions: ['node', 'node-addons'],
    },
    // @@@@ 테스트 파일 경로 규칙: testMatch 글롭 대신 roots + testRegex.
    // `**` 글롭은 점(.)으로 시작하는 경로 세그먼트를 건너뛰므로, 체크아웃이
    // dot-디렉터리(예: `.claude/worktrees/…` git worktree) 아래에 있으면 테스트를
    // 하나도 찾지 못한다. kride/jest.config.ts와 동일한 해결책.
    // (src/는 존재하지 않아 기존 testMatch의 src 글롭도 죽은 항목이었다)
    roots: ["<rootDir>/tests"],
    testRegex: "tests[\\\\/].*\\.(test|spec)\\.(ts|tsx)$",
    // @@@@ Playwright E2E 테스트는 Jest에서 제외 (npx playwright test 로 실행)
    // 경로 구분자 양쪽([/\\]) 대응: Windows에서는 '\'라 '/tests/e2e/' 패턴이 안 걸린다.
    testPathIgnorePatterns: [
        "node_modules[/\\\\]",
        "tests[/\\\\]e2e[/\\\\]"
    ],
    reporters: [
        "default",  // 터미널 출력을 위해 기본 리포터 유지
        ["jest-html-reporter", {
            "pageTitle": "메타데이터 테스트 리포트",
            // @@@@ 로그 폴더 지정: tests/logs 폴더 안에 생성되도록 설정
            "outputPath": "./tests/logs/frontend-report.html",
            "includeFailureMsg": true,
            "dateFormat": "yyyy-mm-dd HH:MM:ss"
        }],
        "<rootDir>/tests/CustomReporter.js" // 커스텀 리포터 추가
    ]
};
