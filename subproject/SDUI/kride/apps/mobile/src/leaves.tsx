import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { authHeader, type SduiLeafProps } from '@kride/core';

/**
 * Mobile display leaves (P4, 1st pass) — direct RN ports of the web atoms.
 * Display-only; stateful/interactive leaves (SELECTION_CARD, sliders, COLLAPSE_*,
 * ITINERARY_PANEL) are deferred to a later pass that needs the shared onboarding
 * store and a gesture/slider library.
 */

export const CardImageLeaf: React.FC<SduiLeafProps> = ({ meta, data }) => {
  const src = data?.imageUrl || meta?.imageUrl;
  const circle = String(meta?.cssClass || meta?.css_class || '').includes('circle');
  return (
    <View className={`aspect-square w-full overflow-hidden ${circle ? 'rounded-full' : 'rounded-lg'}`}>
      {src ? <Image source={{ uri: src }} className="h-full w-full" resizeMode="cover" /> : null}
    </View>
  );
};

/**
 * Generic IMAGE leaf. Only absolute URLs render: relative paths in metadata
 * (e.g. INTRO1's `/images/kride_hero.png`) are web-app public assets that do
 * not exist on the device or the API host.
 */
export const RemoteImageLeaf: React.FC<SduiLeafProps> = ({ meta, data }) => {
  const raw = (typeof data === 'string' && data) || data?.src || meta?.labelText || meta?.label_text || '';
  const src = String(raw);
  if (!/^https?:\/\//.test(src)) return null;
  return <Image source={{ uri: src }} className="h-48 w-full rounded-xl" resizeMode="cover" />;
};

export const CardLabelLeaf: React.FC<SduiLeafProps> = ({ meta, data }) => {
  const text = data?.name || meta?.labelText || meta?.label_text || '';
  return <Text className="mt-1 w-full text-center text-sm text-white" numberOfLines={1}>{String(text)}</Text>;
};

export const DurationLabelLeaf: React.FC<SduiLeafProps> = ({ meta, data }) => {
  const text = data?.label || meta?.labelText || meta?.label_text || '';
  return <Text className="text-base font-semibold text-white">{String(text)}</Text>;
};

const PURPOSE_EMOJI: Record<string, string> = {
  food: '🍜', kculture: '🎤', nature: '🌿', history: '🏛️', shopping: '🛍️', rest: '🛁',
};

export const PurposeIconLeaf: React.FC<SduiLeafProps> = ({ meta, data }) => {
  const key = data?.purposeKey || meta?.cssClass || meta?.css_class || '';
  const emoji = PURPOSE_EMOJI[key] || '📍';
  return <Text className="text-2xl">{emoji}</Text>;
};

export const RouteNodeLeaf: React.FC<SduiLeafProps> = ({ meta, data }) => {
  const index = Number(meta?.index ?? data?.index ?? 0);
  const name = data?.name || data?.placeName || data?.place_name || '';
  const desc = data?.description || data?.address || '';
  return (
    <View className="flex-row items-start gap-3 py-2">
      <View className="h-6 w-6 items-center justify-center rounded-full bg-kride">
        <Text className="text-xs font-bold text-white">{index + 1}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-medium text-white" numberOfLines={1}>{String(name)}</Text>
        {desc ? <Text className="text-xs text-gray-400" numberOfLines={1}>{String(desc)}</Text> : null}
      </View>
    </View>
  );
};

export const RangeLabelLeaf: React.FC<SduiLeafProps> = ({ meta, data }) => {
  const value = Number(data?.value ?? meta?.value ?? 0);
  return <Text className="text-sm font-medium text-white">{`₩${value.toLocaleString('ko-KR')}`}</Text>;
};

export const CheckIndicatorLeaf: React.FC<SduiLeafProps> = ({ meta, data }) => {
  const selected = data?.selected ?? meta?.selected ?? false;
  if (!selected) return null;
  return (
    <View className="absolute inset-0 items-center justify-center rounded-lg border-4 border-kride">
      <View className="rounded-full bg-kride p-1">
        <Text className="text-xs font-bold text-white">✓</Text>
      </View>
    </View>
  );
};

const kpopName = (data?: Record<string, any>) =>
  data?.nameKo || data?.name_ko || data?.nameEn || data?.name || 'K-POP';

const requestKpop = async (apiBase: string, path: string, method = 'POST') => {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
};

const actionError = (error: unknown) =>
  error instanceof Error && error.message === '401'
    ? '로그인 후 이용해 주세요.'
    : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';

export const ArtistCardLeaf: React.FC<SduiLeafProps> = ({ data, meta, onAction, apiBase = '' }) => {
  const name = kpopName(data);
  const imageUrl = data?.imageUrl || data?.image_url;
  const [followed, setFollowed] = useState(Boolean(data?.followed));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const follow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await requestKpop(apiBase, `/api/v1/kpop/artists/${data?.id}/follow`, followed ? 'DELETE' : 'POST');
      setFollowed((current) => !current);
      setStatus(followed ? '팔로우를 취소했습니다.' : '팔로우했습니다.');
    } catch (error) {
      setStatus(actionError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="mb-3 overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <View className="h-32 w-full bg-neutral-100">
        {imageUrl ? (
          <Image
            accessibilityLabel={`${name} 아티스트 이미지`}
            accessible
            source={{ uri: imageUrl }}
            className="h-full w-full"
            resizeMode="cover"
          />
        ) : (
          <View accessible accessibilityLabel={`${name} 아티스트 이미지 없음`} className="h-full w-full items-center justify-center bg-rose-50">
            <Text className="text-4xl font-bold text-kride">{String(name).slice(0, 1)}</Text>
          </View>
        )}
      </View>
      <View className="gap-2 p-4">
        <Text className="text-xs font-semibold uppercase text-kride">아티스트</Text>
        <Text accessibilityRole="header" className="text-lg font-bold text-neutral-950">{String(name)}</Text>
        <Text className="text-sm text-neutral-600" numberOfLines={2}>
          {String(data?.profile || '이벤트, 팬 동선, 근거가 확인된 상품 후보 소식을 확인해 보세요.')}
        </Text>
        <View className="mt-2 flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${name} 상세 보기`}
            accessibilityHint="아티스트 상세 화면으로 이동합니다."
            className="min-h-12 justify-center rounded-full border border-kride px-4 py-2"
            onPress={() => onAction?.({ ...meta, actionType: 'ROUTE', actionUrl: `/kpop/artists?artistId=${data?.id}` }, data)}
          >
            <Text className="font-semibold text-kride">상세 보기</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${name} ${followed ? '팔로우 취소' : '팔로우'}`}
            accessibilityState={{ disabled: busy, selected: followed }}
            className="min-h-12 justify-center rounded-full bg-kride px-4 py-2"
            disabled={busy}
            onPress={follow}
          >
            <Text className="font-semibold text-white">{busy ? '처리 중…' : followed ? '팔로잉' : '팔로우'}</Text>
          </Pressable>
        </View>
        {status ? <Text accessibilityLiveRegion="polite" className="text-xs text-neutral-700">{status}</Text> : null}
      </View>
    </View>
  );
};

export const EventCardLeaf: React.FC<SduiLeafProps> = ({ data, meta, onAction, apiBase = '' }) => {
  const title = data?.titleKo || data?.title_ko || data?.titleEn || data?.title || 'K-POP event';
  const [bookmarked, setBookmarked] = useState(Boolean(data?.bookmarked));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const bookmark = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // 팔로우와 동일한 토글: 저장된 상태에서 다시 누르면 DELETE로 해제한다.
      await requestKpop(apiBase, `/api/v1/kpop/events/${data?.id}/bookmark`, bookmarked ? 'DELETE' : 'POST');
      setBookmarked((current) => !current);
      setStatus(bookmarked ? '이벤트 저장을 취소했습니다.' : '이벤트를 저장했습니다.');
    } catch (error) {
      setStatus(actionError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="mb-3 rounded-xl border border-neutral-200 bg-white p-4">
      <Text className="text-xs font-semibold uppercase text-kride">
        {String(data?.artistNameKo || data?.artistName || 'Event')}
      </Text>
      <Text accessibilityRole="header" className="mt-1 text-lg font-bold text-neutral-950">{String(title)}</Text>
      <Text className="mt-2 text-sm text-neutral-600" numberOfLines={2}>
        {[data?.region, data?.venue, data?.date].filter(Boolean).join(' - ')}
      </Text>
      <Text className="mt-2 text-xs text-neutral-500" numberOfLines={2}>
        공식 또는 운영 검수를 거친 링크인지 확인한 뒤 이용해 주세요.
      </Text>
      <View className="mt-3 flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title} 상세 보기`}
          accessibilityHint="이벤트 상세 화면으로 이동합니다."
          className="min-h-12 justify-center rounded-full border border-kride px-4 py-2"
          onPress={() => onAction?.({ ...meta, actionType: 'ROUTE', actionUrl: `/kpop/event?eventId=${data?.id}` }, data)}
        >
          <Text className="font-semibold text-kride">상세 보기</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title} ${bookmarked ? '저장 취소' : '저장'}`}
          accessibilityState={{ disabled: busy, selected: bookmarked }}
          className="min-h-12 justify-center rounded-full bg-kride px-4 py-2"
          disabled={busy}
          onPress={bookmark}
        >
          <Text className="font-semibold text-white">{busy ? '저장 중…' : bookmarked ? '저장됨' : '저장'}</Text>
        </Pressable>
      </View>
      {status ? <Text accessibilityLiveRegion="polite" className="mt-2 text-xs text-neutral-700">{status}</Text> : null}
    </View>
  );
};
