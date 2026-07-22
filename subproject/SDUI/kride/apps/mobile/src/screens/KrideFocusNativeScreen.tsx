import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authHeader, useOnboardingStore } from '@kride/core';
import KrideMap from '../components/KrideMap';

type MarkerData = { id?: string; lat: number; lng: number; name?: string };
type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string; error?: boolean };
type ChatPayload = {
  reply?: string;
  recommendationText?: string;
  pois?: Array<Record<string, unknown>>;
  itinerary?: Record<string, any>;
};

type Props = {
  apiBase: string;
  onBack?: () => void;
};

const SUGGESTIONS = [
  '서울 하루 코스 추천',
  '강남 데이트 코스 짜줘',
  '사진 명소 중심으로 추천해줘',
];

const durationToDays = (duration: string | null) => (
  duration === 'twonight' ? 3 : duration === 'onenight' ? 2 : 1
);

const classifyIntent = (message: string) => {
  if (/일정|코스|여행 계획/.test(message)) return 'itinerary';
  if (/추천|맛집|관광지|촬영지/.test(message)) return 'recommend';
  return 'qa';
};

const normalizeMarker = (value: Record<string, any>, index: number): MarkerData | null => {
  const lat = Number(value.lat ?? value.latitude);
  const lng = Number(value.lng ?? value.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: String(value.id ?? `marker-${index}`),
    lat,
    lng,
    name: String(value.name ?? value.title ?? ''),
  };
};

export const extractChatMarkers = (payload: ChatPayload): MarkerData[] => {
  const itinerary = payload.itinerary ?? {};
  const explicit = itinerary.mapData?.markers ?? itinerary.markers;
  const candidates: Array<Record<string, any>> = Array.isArray(explicit)
    ? explicit
    : Array.isArray(payload.pois)
      ? payload.pois
      : [];

  if (candidates.length > 0) {
    return candidates.map(normalizeMarker).filter((marker): marker is MarkerData => Boolean(marker));
  }

  const days = Array.isArray(itinerary.days)
    ? itinerary.days
    : Array.isArray(itinerary.itinerary)
      ? itinerary.itinerary
      : [];
  const places = days.flatMap((day: any) => [
    ...(day?.morning?.places ?? []),
    ...(day?.afternoon?.places ?? []),
    ...(day?.places ?? []),
  ]);
  return places.map(normalizeMarker).filter((marker: MarkerData | null): marker is MarkerData => Boolean(marker));
};

const messageId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function KrideFocusNativeScreen({ apiBase, onBack }: Props) {
  const duration = useOnboardingStore((state) => state.duration);
  const selectedArtists = useOnboardingStore((state) => state.selectedArtists);
  const selectedRegions = useOnboardingStore((state) => state.selectedRegions);
  const purposes = useOnboardingStore((state) => state.purposes);
  const budget = useOnboardingStore((state) => state.budget);
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const requestContext = useMemo(() => ({
    artists: selectedArtists.map((artist) => artist.name),
    regions: selectedRegions.map((region) => region.name),
    purposes,
    duration: durationToDays(duration),
    budget: [budget.min, budget.max],
  }), [budget.max, budget.min, duration, purposes, selectedArtists, selectedRegions]);

  const send = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text || isSending) return;

    const userMessage: ChatMessage = { id: messageId(), role: 'user', text };
    const pendingId = messageId();
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setIsSending(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(`${apiBase}/api/v1/kride/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ message: text, intent: classifyIntent(text), ...requestContext }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = await response.json();
      const payload: ChatPayload = json?.data ?? json;
      const nextMarkers = extractChatMarkers(payload);
      if (nextMarkers.length > 0) setMarkers(nextMarkers);
      setMessages((current) => [...current, {
        id: pendingId,
        role: 'assistant',
        text: payload.reply || payload.recommendationText || '추천 결과를 지도에 반영했어요.',
      }]);
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      setMessages((current) => [...current, {
        id: pendingId,
        role: 'assistant',
        text: aborted
          ? '응답이 늦어 요청을 멈췄어요. 잠시 후 다시 시도해 주세요.'
          : '여행봇 연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.',
        error: true,
      }]);
    } finally {
      clearTimeout(timeout);
      abortRef.current = null;
      setIsSending(false);
    }
  }, [apiBase, isSending, requestContext]);

  return (
    <SafeAreaView testID="kride-focus-screen" edges={['top', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView
        testID="kride-focus-keyboard"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardLayout}
      >
        <View style={styles.header}>
          {onBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel="이전 화면" onPress={onBack} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>이전</Text>
            </Pressable>
          ) : <View style={styles.headerSpacer} />}
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>동선</Text>
            <Text style={styles.title}>K-RIDE 여행봇</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={chatOpen ? '여행봇 닫기' : '여행봇 열기'}
            onPress={() => setChatOpen((open) => !open)}
            style={styles.headerButton}
          >
            <Text style={styles.headerButtonText}>{chatOpen ? '닫기' : '열기'}</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <View testID="kride-focus-map-region" style={[styles.mapRegion, !chatOpen && styles.mapRegionExpanded]}>
            <KrideMap markers={markers} style={styles.map} />
            <View pointerEvents="none" style={styles.mapBadge}>
              <Text style={styles.mapBadgeText}>{markers.length > 0 ? `${markers.length}개 장소` : '추천 동선 준비 중'}</Text>
            </View>
          </View>

          {chatOpen ? (
            <View testID="kride-focus-chat-region" style={styles.chatRegion}>
              <FlatList
                data={messages}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.thread}
                renderItem={({ item }) => (
                  <View style={[styles.message, item.role === 'user' ? styles.userMessage : styles.assistantMessage]}>
                    <Text style={[styles.messageText, item.role === 'user' && styles.userMessageText, item.error && styles.errorText]}>
                      {item.text}
                    </Text>
                  </View>
                )}
                ListEmptyComponent={(
                  <View style={styles.emptyState}>
                    <Text style={styles.rai}>🧭</Text>
                    <View style={styles.emptyCopy}>
                      <Text style={styles.emptyTitle}>라이가 취향에 맞는 코스를 준비할게요</Text>
                      <Text style={styles.emptyDescription}>추천 질문을 누르거나 원하는 여행을 직접 알려주세요.</Text>
                    </View>
                  </View>
                )}
                ListFooterComponent={isSending ? (
                  <View accessibilityRole="progressbar" style={styles.sending}>
                    <ActivityIndicator color="#e50914" size="small" />
                    <Text style={styles.sendingText}>라이가 답을 찾고 있어요</Text>
                  </View>
                ) : null}
              />

              {messages.length === 0 ? (
                <View accessibilityLabel="추천 질문" style={styles.suggestions}>
                  {SUGGESTIONS.map((suggestion) => (
                    <Pressable key={suggestion} onPress={() => void send(suggestion)} style={styles.suggestionChip}>
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <View style={styles.composer}>
                <TextInput
                  accessibilityLabel="여행봇 메시지"
                  editable={!isSending}
                  onChangeText={setInput}
                  onSubmitEditing={() => void send(input)}
                  placeholder="원하는 여행을 알려주세요"
                  placeholderTextColor="#9ca3af"
                  returnKeyType="send"
                  style={styles.input}
                  value={input}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="메시지 보내기"
                  disabled={!input.trim() || isSending}
                  onPress={() => void send(input)}
                  style={[styles.sendButton, (!input.trim() || isSending) && styles.sendButtonDisabled]}
                >
                  <Text style={styles.sendButtonText}>전송</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#09090b', flex: 1 },
  keyboardLayout: { flex: 1 },
  header: {
    alignItems: 'center',
    borderBottomColor: '#27272a',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 12,
  },
  headerCopy: { alignItems: 'center', flex: 1 },
  eyebrow: { color: '#e50914', fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  title: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
  headerButton: { alignItems: 'center', minWidth: 52, paddingHorizontal: 8, paddingVertical: 10 },
  headerButtonText: { color: '#f4f4f5', fontSize: 13, fontWeight: '700' },
  headerSpacer: { width: 52 },
  body: { flex: 1 },
  mapRegion: {
    flex: 0.86,
    minHeight: 176,
    overflow: 'hidden',
    position: 'relative',
  },
  mapRegionExpanded: { flex: 1 },
  map: { flex: 1 },
  mapBadge: {
    backgroundColor: 'rgba(9, 9, 11, 0.82)',
    borderRadius: 999,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    position: 'absolute',
    top: 12,
  },
  mapBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  chatRegion: {
    backgroundColor: '#18181b',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    flex: 1.14,
    minHeight: 288,
    overflow: 'hidden',
  },
  thread: { flexGrow: 1, gap: 9, paddingHorizontal: 16, paddingTop: 14 },
  emptyState: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingVertical: 6 },
  rai: { fontSize: 34 },
  emptyCopy: { flex: 1 },
  emptyTitle: { color: '#ffffff', fontSize: 15, fontWeight: '800', lineHeight: 21 },
  emptyDescription: { color: '#a1a1aa', fontSize: 12, lineHeight: 18, marginTop: 2 },
  message: { borderRadius: 16, maxWidth: '86%', paddingHorizontal: 13, paddingVertical: 9 },
  userMessage: { alignSelf: 'flex-end', backgroundColor: '#e50914' },
  assistantMessage: { alignSelf: 'flex-start', backgroundColor: '#27272a' },
  messageText: { color: '#f4f4f5', fontSize: 13, lineHeight: 19 },
  userMessageText: { color: '#ffffff' },
  errorText: { color: '#fecaca' },
  sending: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingVertical: 8 },
  sendingText: { color: '#a1a1aa', fontSize: 12 },
  suggestions: { flexDirection: 'row', gap: 7, paddingHorizontal: 12, paddingVertical: 8 },
  suggestionChip: {
    backgroundColor: '#27272a',
    borderColor: '#3f3f46',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  suggestionText: { color: '#e4e4e7', fontSize: 10, textAlign: 'center' },
  composer: {
    alignItems: 'center',
    borderTopColor: '#27272a',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  input: {
    backgroundColor: '#27272a',
    borderRadius: 14,
    color: '#ffffff',
    flex: 1,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#e50914',
    borderRadius: 13,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 15,
  },
  sendButtonDisabled: { opacity: 0.42 },
  sendButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
});
