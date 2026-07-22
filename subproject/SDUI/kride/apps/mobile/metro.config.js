const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
// Watch only the app and the shared core package (not the whole workspace) to keep
// Watchman crawl/query fast. The local `index.js` entry keeps the dev-server bundle
// URL inside projectRoot, so watching the workspace root is unnecessary.
config.watchFolders = [path.resolve(workspaceRoot, 'packages/core')];
// One-shot builds (`expo export`) never need file watching, and Watchman's crawl of
// this repo on D: can wedge its server for good. Opt out with EXPO_NO_WATCHMAN=1 to
// fall back to Metro's node crawler; the dev server keeps using Watchman.
if (process.env.EXPO_NO_WATCHMAN === '1') {
  config.resolver.useWatchman = false;
}
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

const nwConfig = withNativeWind(config, { input: './global.css' });

// Force a single copy of react-native and react (the app-local ones). The
// hoisted root `expo` can otherwise pull an incompatible nested react-native
// (newer major) whose Flow source the SDK 51 Babel preset cannot parse.
const forced = {
  'react-native': path.resolve(workspaceRoot, 'node_modules/react-native'),
  react: path.resolve(workspaceRoot, 'node_modules/react'),
};
const upstreamResolveRequest = nwConfig.resolver.resolveRequest;
nwConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  for (const name of Object.keys(forced)) {
    if (moduleName === name || moduleName.startsWith(name + '/')) {
      return context.resolveRequest(
        context,
        forced[name] + moduleName.slice(name.length),
        platform,
      );
    }
  }
  return (upstreamResolveRequest || context.resolveRequest)(context, moduleName, platform);
};

module.exports = nwConfig;
