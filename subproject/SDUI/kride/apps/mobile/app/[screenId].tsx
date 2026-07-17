import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { DynamicEngine, PATH_TO_SCREEN, resolveRuntimeConfig, usePageHook, useUiScreen } from '@kride/core';
import { rnPrimitives } from '../src/primitives';
import { mobileComponentMap } from '../src/componentMap';

// Stable references. `useBaseActions` in @kride/core resets form state during
// render whenever `metadata`/`routeParams`/`initialData` change *by reference*.
// Passing fresh literals (`data ?? []`, `{ screenId }`, `{}`) every render made
// those guards fire on every render → "Too many re-renders" infinite loop.
const EMPTY_METADATA: any[] = [];
const EMPTY_OBJ = {};

const MOBILE_ROUTE_ALIASES: Record<string, string> = {
  '/': '/MAIN_PAGE',
  '/main': '/MAIN_PAGE',
  '/login': '/LOGIN_PAGE',
  '/register': '/REGISTER_PAGE',
  '/set-time': '/SET_TIME_PAGE',
  '/tutorial': '/TUTORIAL_PAGE',
};

const normalizeMobileRoute = (rawPath: string) => {
  const parsed = rawPath.startsWith('http') ? new URL(rawPath) : null;
  const pathWithQuery = parsed ? `${parsed.pathname}${parsed.search}` : rawPath;
  const [pathname, query = ''] = pathWithQuery.split('?');
  const fromViewRoute = pathname.startsWith('/view/') ? pathname.replace(/^\/view\//, '/') : pathname;
  const fromCoreMap = PATH_TO_SCREEN[fromViewRoute] ? `/${PATH_TO_SCREEN[fromViewRoute]}` : fromViewRoute;
  const normalizedPath = MOBILE_ROUTE_ALIASES[fromCoreMap] || fromCoreMap;
  return query ? `${normalizedPath}?${query}` : normalizedPath;
};

export default function MobileScreen() {
  const { screenId } = useLocalSearchParams<{ screenId: string }>();
  const router = useRouter();
  const sid = screenId ?? 'MAIN_PAGE';
  const apiBase = resolveRuntimeConfig({ apiBase: process.env.EXPO_PUBLIC_API_BASE }).apiBase;
  const { data, isLoading, error } = useUiScreen(sid, apiBase);

  // react-query keeps `data` referentially stable until it actually changes;
  // fall back to a module-level constant so the reference is stable while loading.
  const metadata = data ?? EMPTY_METADATA;
  const navigation = useMemo(
    () => ({
      push: (path: string) => {
        // The server emits web-style routes (`/view/<screenId>`); the mobile
        // router uses `/<screenId>` (app/[screenId].tsx). Normalize aliases so
        // pushes land on a real route instead of an empty or unmatched page.
        const normalized = normalizeMobileRoute(path);
        router.push(normalized as never);
      },
      openExternal: (url: string) => {
        void Linking.openURL(url);
      },
      notify: (message: string) => Alert.alert(message),
    }),
    [router],
  );
  const routeParams = useMemo(() => ({ screenId }), [screenId]);
  const runtime = useMemo(() => ({ apiBase }), [apiBase]);

  const page = usePageHook(sid, metadata, EMPTY_OBJ, navigation, routeParams, runtime);

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
          metadata={metadata}
          screenId={sid}
          pageData={EMPTY_OBJ}
          formData={page.formData}
          setFormData={page.setFormData}
          onChange={page.handleChange}
          onAction={page.handleAction}
          primitives={rnPrimitives}
          componentMap={mobileComponentMap}
        />
      </View>
    </ScrollView>
  );
}
