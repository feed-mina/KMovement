module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // No explicit react-native-reanimated/plugin here: babel-preset-expo (SDK
    // 50+) adds it automatically when react-native-reanimated is resolvable,
    // which is why it is hoisted to the workspace root (see //mobileHoist).
    // Adding it again would run the worklet transform twice.
  };
};
