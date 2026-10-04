import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { PostcodeResult } from '@kride/core';
import AddressSearchModal from '../src/components/AddressSearchModal';

const enabled = process.env.EXPO_PUBLIC_F2_CHECK === 'true';
const apiBase = process.env.EXPO_PUBLIC_ADDRESS_API_BASE ?? process.env.EXPO_PUBLIC_API_BASE ?? '';
const testQuery = process.env.EXPO_PUBLIC_F2_TEST_QUERY ?? '';

/**
 * CI Android smoke screen. Production and normal preview builds keep it disabled;
 * the verification workflow explicitly enables it for an ephemeral APK only.
 */
export default function F2AddressCheckScreen() {
  const [visible, setVisible] = useState(enabled);
  const [selected, setSelected] = useState<PostcodeResult | null>(null);

  if (!enabled) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-center text-base text-gray-700">F2 검증 화면이 비활성화되어 있습니다.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="mb-4 text-xl font-bold text-gray-950">F2 Android 검증</Text>
      {selected ? (
        <Text accessibilityLabel={`선택 완료: ${selected.zipCode} ${selected.roadAddress}`} className="text-center text-base">
          선택 완료{`\n`}[{selected.zipCode}] {selected.roadAddress}
        </Text>
      ) : null}
      <Pressable accessibilityRole="button" className="mt-5 rounded-xl bg-kride px-5 py-3" onPress={() => setVisible(true)}>
        <Text className="font-bold text-white">주소 검색 열기</Text>
      </Pressable>
      <AddressSearchModal
        visible={visible}
        apiBase={apiBase}
        initialKeyword={testQuery}
        onComplete={(result) => {
          setSelected(result);
          setVisible(false);
        }}
        onClose={() => setVisible(false)}
      />
    </View>
  );
}
