import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  // Watchman on this Windows host can fail while opening its user-profile log
  // and dump the child environment. Use Jest's filesystem crawler instead.
  watchman: false,
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|less|scss|sass)$": "<rootDir>/src/__tests__/__mocks__/styleMock.ts",
    "^next/navigation$": "<rootDir>/src/__tests__/__mocks__/next-navigation.ts",
    "^next/dynamic$":    "<rootDir>/src/__tests__/__mocks__/next-dynamic.ts",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: { jsx: "react-jsx" },
        isolatedModules: true,
        diagnostics: false,
      },
    ],
  },
  // `roots` + `testRegex` rather than a testMatch glob: `**` skips path segments
  // that start with a dot, so glob discovery finds nothing when the checkout
  // lives under a dot-directory (e.g. a git worktree in `.claude/worktrees/`).
  // `roots` keeps discovery inside src, as the old glob's prefix did — without
  // it, apps/mobile's React Native tests get pulled into this jsdom project.
  roots: ["<rootDir>/src"],
  testRegex: "__tests__[\\\\/].*\\.test\\.(ts|tsx)$",
};

export default config;
