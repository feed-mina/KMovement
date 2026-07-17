/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // testRegex rather than jest's default testMatch globs: `**` skips path
  // segments that start with a dot, so glob discovery finds nothing when the
  // checkout lives under a dot-directory (e.g. a worktree in `.claude/`).
  testRegex: 'src[\\\\/]__tests__[\\\\/].*\\.test\\.(ts|tsx)$',
  moduleNameMapper: {
    // These mirror metro.config.js, which resolves the same packages by absolute
    // path. npm splits this workspace — react-native is hoisted to the root
    // while nativewind stays app-local, and react exists in both places — so
    // plain Node resolution finds neither a complete nor a single copy.
    //
    // babel.config.js sets jsxImportSource: 'nativewind', so every JSX file
    // needs nativewind's runtime, which only exists here.
    '^nativewind(.*)$': '<rootDir>/node_modules/nativewind$1',
    '^react-native-css-interop(.*)$': '<rootDir>/node_modules/react-native-css-interop$1',
    // One copy of react, the hoisted one metro forces at runtime. Without this
    // the app-local copy renders while react-test-renderer drives the root one,
    // and every hook call throws.
    '^react$': '<rootDir>/../../node_modules/react',
    '^react/(.*)$': '<rootDir>/../../node_modules/react/$1',
    // …and the renderer must match that react. @testing-library/react-native
    // pulls in its own react-test-renderer@18.2.0, which npm hoists to the root
    // and which would otherwise drive react 18.3.1.
    '^react-test-renderer$': '<rootDir>/node_modules/react-test-renderer',
    '^react-test-renderer/(.*)$': '<rootDir>/node_modules/react-test-renderer/$1',
  },
};
