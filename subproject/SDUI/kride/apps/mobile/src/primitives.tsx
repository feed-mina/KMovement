import { Pressable, Text, View } from 'react-native';
import type { PrimitiveRegistry } from '@kride/core';

/**
 * React Native implementations of the platform-neutral primitive contract.
 * className is resolved by NativeWind, keeping the server's `css_class` contract
 * identical to the web renderer.
 */
export const rnPrimitives: PrimitiveRegistry = {
  Box: ({ className, children, onPress, testID }) =>
    onPress ? (
      <Pressable className={className} onPress={onPress} testID={testID}>
        {children}
      </Pressable>
    ) : (
      <View className={className} testID={testID}>
        {children}
      </View>
    ),
  Txt: ({ className, children, testID }) => (
    <Text className={className} testID={testID}>
      {children}
    </Text>
  ),
  Btn: ({ className, children, onPress, testID }) => (
    <Pressable className={className} onPress={onPress} testID={testID}>
      <Text className="text-center font-bold text-white">{children}</Text>
    </Pressable>
  ),
};
