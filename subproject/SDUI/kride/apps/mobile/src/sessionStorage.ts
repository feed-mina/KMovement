import * as SecureStore from 'expo-secure-store';
import type { SessionStorage } from '@kride/core';

/**
 * expo-secure-store adapter for @kride/core's session store. Kept in the app so
 * core stays free of native dependencies and still builds for web.
 */
export const secureSessionStorage: SessionStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value).then(() => undefined),
  removeItem: (key) => SecureStore.deleteItemAsync(key).then(() => undefined),
};
