import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { resolveRuntimeConfig, useUiScreen } from '@kride/core';
import MobileDynamicEngine from '../src/components/MobileDynamicEngine';

export default function MobileScreen() {
  const { screenId } = useLocalSearchParams<{ screenId: string }>();
  const config = resolveRuntimeConfig({ apiBase: process.env.EXPO_PUBLIC_API_BASE });
  const { data, isLoading, error } = useUiScreen(screenId ?? 'MAIN_PAGE', config.apiBase);
  if (isLoading) return <View className="flex-1 items-center justify-center"><Text>불러오는 중…</Text></View>;
  if (error) return <View className="flex-1 items-center justify-center px-6"><Text className="text-red-600">화면을 불러오지 못했습니다.</Text></View>;
  return <View className="flex-1 bg-white px-5 pt-16"><Text className="mb-6 text-2xl font-bold text-kride">KRIDE</Text><MobileDynamicEngine metadata={data ?? []} onAction={(meta) => console.log('mobile action', meta.actionType || meta.action_type)} /></View>;
}
