import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { DynamicEngine, PATH_TO_SCREEN, resolveRuntimeConfig, useKpopPageData, usePageHook, useSqlPageData, useUiScreen } from '@kride/core';
import type { PostcodeResult } from '@kride/core';
import { rnPrimitives } from '../src/primitives';
import { mobileComponentMap } from '../src/componentMap';
import AddressSearchModal from '../src/components/AddressSearchModal';
import KrideFocusNativeScreen from '../src/screens/KrideFocusNativeScreen';
import CommunityNativeScreen from '../src/screens/CommunityNativeScreen';
import { withKakaoAppState } from '../src/kakaoLogin';
import { publicApiOrigin, summarizeMobileFailure } from '../src/mobileDiagnostics';

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
  '/community': '/COMMUNITY_LIST',
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
  const { screenId, artistId, eventId, jobId, region, from, to, q, email, code } = useLocalSearchParams<{
    screenId: string;
    artistId?: string;
    eventId?: string;
    jobId?: string;
    region?: string;
    from?: string;
    to?: string;
    q?: string;
    email?: string;
    code?: string;
  }>();
  const router = useRouter();
  // Holds the OPEN_POSTCODE callback while the address modal is up; non-null
  // doubles as the modal's visibility flag.
  const [postcodeApply, setPostcodeApply] = useState<((result: PostcodeResult) => void) | null>(null);
  const sid = screenId ?? 'MAIN_PAGE';
  const apiBase = resolveRuntimeConfig({ apiBase: process.env.EXPO_PUBLIC_API_BASE }).apiBase;
  const { data, isLoading, error } = useUiScreen(sid, apiBase);
  const { data: kpopPageData } = useKpopPageData(sid, apiBase, {
    artistId,
    eventId,
    region,
    from,
    to,
  });

  // react-query keeps `data` referentially stable until it actually changes;
  // fall back to a module-level constant so the reference is stable while loading.
  const metadata = data ?? EMPTY_METADATA;
  // Repeater lists the metadata binds by data_sql_key (e.g. KRIDE_INTRO2/3's
  // artist/region grids) — the web engine auto-fetches these, so mobile must too.
  const { data: sqlPageData } = useSqlPageData(sid, metadata, apiBase);
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
        // Kakao OAuth must round-trip back into the app: state=app makes the
        // server callback 302 to kride://kakao-callback instead of the web URL.
        void Linking.openURL(withKakaoAppState(url));
      },
      notify: (message: string) => Alert.alert(message),
      openPostcode: (onComplete: (result: PostcodeResult) => void) => {
        setPostcodeApply(() => onComplete);
      },
    }),
    [router],
  );
  const routeParams = useMemo(() => ({ screenId, email, code }), [screenId, email, code]);
  const runtime = useMemo(() => ({ apiBase }), [apiBase]);
  const analysisPageData = useMemo(() => ({ jobId: jobId || '' }), [jobId]);
  const productPageData = useMemo(() => ({ q: q || '', artistId: artistId || '', eventId: eventId || '' }), [artistId, eventId, q]);
  const mergedPageData = useMemo(() => {
    if (!sqlPageData && !kpopPageData) return EMPTY_OBJ;
    return { ...(sqlPageData ?? {}), ...(kpopPageData ?? {}) };
  }, [sqlPageData, kpopPageData]);
  const dynamicPageData = sid === 'KPOP_AI_RESULT'
    ? analysisPageData
    : sid === 'KPOP_PRODUCTS'
      ? productPageData
      : mergedPageData;

  const page = usePageHook(sid, metadata, EMPTY_OBJ, navigation, routeParams, runtime);

  // The focus screen owns a map, an independently scrollable chat thread and a
  // keyboard-bound composer. The generic page ScrollView made those regions
  // compete for height, so this screen uses its own bounded native layout.
  if (sid === 'KRIDE_FOCUS') {
    return <KrideFocusNativeScreen apiBase={apiBase} onBack={() => router.back()} />;
  }

  // COMMUNITY_LIST predates the newer SDUI screen migrations and is already
  // linked from MAIN_PAGE. Render its native workflow directly so mobile post,
  // comment, like/follow, and report actions remain usable even when a target
  // environment has not received optional community presentation metadata.
  if (sid === 'COMMUNITY_LIST') {
    return <CommunityNativeScreen apiBase={apiBase} onBack={() => router.back()} />;
  }

  // The loading/error screens double as a diagnostic surface: release APKs
  // give us no logs, so the target server and failure reason must be readable
  // on the device itself.
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text>불러오는 중…</Text>
        <Text className="mt-2 text-xs text-neutral-400">
          {sid} · {publicApiOrigin(apiBase)}
        </Text>
      </View>
    );
  }
  if (error) {
    const failure = summarizeMobileFailure(error);
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-red-600">화면을 불러오지 못했습니다.</Text>
        <Text className="mt-2 text-center text-xs text-neutral-500">
          {sid} · {publicApiOrigin(apiBase)}
        </Text>
        <Text className="mt-1 text-center text-xs text-neutral-400">
          {failure.message} 진단 코드: {failure.code}
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView className="flex-1 bg-white">
        <View className="px-5 pb-10 pt-16">
          <Text className="mb-6 text-2xl font-bold text-kride">KRIDE</Text>
          <DynamicEngine
            metadata={metadata}
            screenId={sid}
            pageData={dynamicPageData}
            formData={page.formData}
            setFormData={page.setFormData}
            onChange={page.handleChange}
            onAction={page.handleAction}
            apiBase={apiBase}
            primitives={rnPrimitives}
            componentMap={mobileComponentMap}
          />
        </View>
      </ScrollView>
      <AddressSearchModal
        visible={postcodeApply != null}
        apiBase={apiBase}
        onComplete={(result) => {
          postcodeApply?.(result);
          setPostcodeApply(null);
        }}
        onClose={() => setPostcodeApply(null)}
      />
    </>
  );
}
