const mobilePackage = require('../../package.json');
const workspacePackage = require('../../../../package.json');

const REQUIRED_COMMUNITY_NATIVE_DEPENDENCIES = [
  '@react-native-async-storage/async-storage',
  '@react-native-community/slider',
  'react-native-maps',
  'react-native-reanimated',
  'react-native-safe-area-context',
  'react-native-screens',
] as const;

describe('mobile native dependency manifest', () => {
  it.each(REQUIRED_COMMUNITY_NATIVE_DEPENDENCIES)(
    'declares %s in the app dependencies used by React Native autolinking',
    (packageName) => {
      expect(mobilePackage.dependencies).toHaveProperty(packageName);
    },
  );

  it('keeps the app and workspace safe-area versions aligned for hoisting', () => {
    expect(mobilePackage.dependencies['react-native-safe-area-context']).toBe('4.10.5');
    expect(mobilePackage.dependencies['react-native-safe-area-context']).toBe(
      workspacePackage.dependencies['react-native-safe-area-context'],
    );
  });
});
