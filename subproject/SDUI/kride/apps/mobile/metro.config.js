const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const config = getDefaultConfig(__dirname);
config.watchFolders = [require('path').resolve(__dirname, '../../packages/core')];
config.resolver.nodeModulesPaths = [require('path').resolve(__dirname, 'node_modules'), require('path').resolve(__dirname, '../../node_modules')];
module.exports = withNativeWind(config, { input: './global.css' });
