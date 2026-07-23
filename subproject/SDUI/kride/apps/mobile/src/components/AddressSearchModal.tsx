import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { PostcodeResult } from '@kride/core';

export type AddressSearchRow = PostcodeResult & {
  jibunAddress?: string;
  buildingName?: string;
};

/** Parses `/api/v1/address/search` responses defensively (unknown JSON in). */
export const parseAddressSearchResponse = (body: unknown): AddressSearchRow[] => {
  const items = (body as any)?.items;
  if (!Array.isArray(items)) return [];
  return items
    .map((item: any) => ({
      zipCode: String(item?.zipCode ?? '').trim(),
      roadAddress: String(item?.roadAddress ?? '').trim(),
      jibunAddress: item?.jibunAddress ? String(item.jibunAddress) : undefined,
      buildingName: item?.buildingName ? String(item.buildingName) : undefined,
    }))
    .filter((item) => item.zipCode && item.roadAddress);
};

type Props = {
  visible: boolean;
  apiBase: string;
  onComplete: (result: PostcodeResult) => void;
  onClose: () => void;
};

/**
 * The web fills zipCode/roadAddress through the Daum postcode iframe, which a
 * native screen cannot host without a WebView dependency. Mobile searches the
 * backend's Kakao Local proxy instead, and keeps a manual-entry escape hatch so
 * signup never dead-ends if the search API is unavailable.
 */
export default function AddressSearchModal({ visible, apiBase, onComplete, onClose }: Props) {
  const [keyword, setKeyword] = useState('');
  const [rows, setRows] = useState<AddressSearchRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualZip, setManualZip] = useState('');
  const [manualRoad, setManualRoad] = useState('');

  const reset = () => {
    setKeyword('');
    setRows([]);
    setSearched(false);
    setLoading(false);
    setError('');
    setManualMode(false);
    setManualZip('');
    setManualRoad('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const apply = (result: PostcodeResult) => {
    onComplete(result);
    reset();
  };

  const search = async () => {
    const query = keyword.trim();
    if (query.length < 2) {
      setError('도로명, 건물명 또는 동 이름을 2자 이상 입력해주세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/api/v1/address/search?keyword=${encodeURIComponent(query)}`);
      if (!res.ok) {
        setRows([]);
        setSearched(true);
        setError('주소 검색에 실패했습니다. 아래 직접 입력을 이용해주세요.');
        return;
      }
      const body = await res.json().catch(() => null);
      setRows(parseAddressSearchResponse(body));
      setSearched(true);
    } catch {
      setRows([]);
      setSearched(true);
      setError('네트워크 오류가 발생했습니다. 아래 직접 입력을 이용해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const manualReady = manualZip.trim().length >= 5 && manualRoad.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="max-h-[85%] rounded-t-2xl bg-white px-5 pb-8 pt-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-gray-950">주소 검색</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={close} className="px-2 py-1">
              <Text className="text-xl text-gray-500">✕</Text>
            </Pressable>
          </View>

          <View className="flex-row gap-2">
            <TextInput
              className="min-h-12 flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-950"
              value={keyword}
              placeholder="예: 테헤란로 152 또는 역삼동"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              returnKeyType="search"
              onChangeText={setKeyword}
              onSubmitEditing={() => void search()}
            />
            <Pressable
              className="min-h-12 items-center justify-center rounded-xl bg-kride px-4"
              accessibilityRole="button"
              onPress={() => void search()}
              disabled={loading}
            >
              <Text className="font-bold text-white">검색</Text>
            </Pressable>
          </View>

          {error ? <Text className="mt-3 text-sm text-red-600">{error}</Text> : null}
          {loading ? <ActivityIndicator className="mt-4" color="#e11d48" /> : null}

          <ScrollView className="mt-3" keyboardShouldPersistTaps="handled">
            {!loading && searched && rows.length === 0 && !error ? (
              <Text className="py-3 text-sm text-gray-500">
                검색 결과가 없습니다. 검색어를 바꾸거나 직접 입력해주세요.
              </Text>
            ) : null}
            {rows.map((row, index) => (
              <Pressable
                key={`${row.zipCode}-${row.roadAddress}-${index}`}
                accessibilityRole="button"
                className="border-b border-gray-100 py-3"
                onPress={() => apply({ zipCode: row.zipCode, roadAddress: row.roadAddress })}
              >
                <Text className="text-base font-semibold text-gray-950">
                  {row.roadAddress}
                  {row.buildingName ? ` (${row.buildingName})` : ''}
                </Text>
                <Text className="mt-1 text-sm text-gray-500">
                  [{row.zipCode}]{row.jibunAddress ? ` ${row.jibunAddress}` : ''}
                </Text>
              </Pressable>
            ))}

            <Pressable
              accessibilityRole="button"
              className="mt-4 self-start"
              onPress={() => setManualMode((current) => !current)}
            >
              <Text className="text-sm font-semibold text-kride">
                {manualMode ? '직접 입력 닫기' : '주소를 찾을 수 없나요? 직접 입력'}
              </Text>
            </Pressable>

            {manualMode ? (
              <View className="mt-3 gap-2 pb-4">
                <TextInput
                  className="min-h-12 rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-950"
                  value={manualZip}
                  placeholder="우편번호 (5자리)"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                  maxLength={5}
                  onChangeText={setManualZip}
                />
                <TextInput
                  className="min-h-12 rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-950"
                  value={manualRoad}
                  placeholder="도로명 주소"
                  placeholderTextColor="#9ca3af"
                  onChangeText={setManualRoad}
                />
                <Pressable
                  className={`min-h-12 items-center justify-center rounded-xl px-4 ${manualReady ? 'bg-kride' : 'bg-gray-300'}`}
                  accessibilityRole="button"
                  disabled={!manualReady}
                  onPress={() => apply({ zipCode: manualZip.trim(), roadAddress: manualRoad.trim() })}
                >
                  <Text className="font-bold text-white">이 주소 사용</Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
