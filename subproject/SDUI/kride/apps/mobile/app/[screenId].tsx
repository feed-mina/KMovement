import { useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { DynamicEngine, resolveRuntimeConfig, useUiScreen } from '@kride/core';
import { rnPrimitives } from '../src/primitives';
import { mobileComponentMap } from '../src/componentMap';

export default function MobileScreen() {
  const { screenId } = useLocalSearchParams<{ screenId: string }>();
  const sid = screenId ?? 'MAIN_PAGE';
  const config = resolveRuntimeConfig({ apiBase: process.env.EXPO_PUBLIC_API_BASE });
  const { data, isLoading, error } = useUiScreen(sid, config.apiBase);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>불러오는 중…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-red-600">화면을 불러오지 못했습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-5 pb-10 pt-16">
        <Text className="mb-6 text-2xl font-bold text-kride">KRIDE</Text>
        <DynamicEngine
          metadata={data ?? []}
          screenId={sid}
          pageData={{}}
          onChange={() => {}}
          onAction={(meta) => console.log('mobile action', meta.actionType || meta.action_type)}
          primitives={rnPrimitives}
          componentMap={mobileComponentMap}
        />
      </View>
    </ScrollView>
  );
}
