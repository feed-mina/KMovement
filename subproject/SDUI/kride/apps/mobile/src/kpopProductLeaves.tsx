import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';
import {
  canOpenKpopOfficialUrl,
  deleteKpopSavedItem,
  getKpopSavedItems,
  saveKpopProductCandidate,
  searchKpopProductCandidates,
  type KpopProductCandidate,
  type KpopSavedItem,
  type SduiLeafProps,
} from '@kride/core';

const errorCopy = (error: unknown, action = '요청') => {
  const message = error instanceof Error ? error.message : String(error);
  if (message === '401' || message.toLowerCase().includes('unauthorized')) {
    return `${action}하려면 로그인해 주세요.`;
  }
  return message || `${action}을 처리하지 못했습니다.`;
};

const gradeCopy = (grade?: string) => {
  switch (String(grade || '').toUpperCase()) {
    case 'EXACT_CANDIDATE':
      return '근거가 비교적 강한 후보 (동일 상품 확정 아님)';
    case 'SIMILAR':
      return '유사 후보';
    default:
      return '근거 부족 · 상품을 단정할 수 없음';
  }
};

export const ProductCandidateCardLeaf: React.FC<{
  candidate: KpopProductCandidate;
  apiBase?: string;
  onRemoved?: (candidate: KpopProductCandidate) => void;
}> = ({ candidate, apiBase = '', onRemoved }) => {
  const [savedItemId, setSavedItemId] = useState<string | number | undefined>(candidate.savedItemId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const canOpen = canOpenKpopOfficialUrl(candidate);

  useEffect(() => setSavedItemId(candidate.savedItemId), [candidate.savedItemId]);

  const toggleSaved = async () => {
    if (!candidate.id || busy) return;
    setBusy(true);
    setMessage('');
    try {
      if (savedItemId) {
        await deleteKpopSavedItem(apiBase, savedItemId);
        setSavedItemId(undefined);
        setMessage('저장을 해제했습니다.');
        onRemoved?.(candidate);
      } else {
        const saved = await saveKpopProductCandidate(apiBase, candidate.id);
        setSavedItemId(saved.id);
        setMessage(candidate.isSaved ? '이미 저장한 후보입니다.' : '후보를 저장했습니다.');
      }
    } catch (error) {
      setMessage(errorCopy(error, savedItemId ? '저장 해제' : '저장'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-2 rounded-xl border border-neutral-200 bg-white p-4">
      <Text className="text-xs font-bold uppercase text-kride">{gradeCopy(candidate.evidenceGrade)}</Text>
      <Text className="text-lg font-bold text-neutral-950">{candidate.name}</Text>
      {candidate.brand ? <Text className="text-sm text-neutral-600">{candidate.brand}</Text> : null}
      {typeof candidate.confidence === 'number' ? (
        <Text className="text-xs text-neutral-500">모델 참고 점수 {Math.round(candidate.confidence)} / 100</Text>
      ) : null}
      <Text className="text-sm leading-5 text-neutral-600">
        {candidate.evidenceText || '확인 가능한 근거가 없습니다. 근거 부족은 정상적인 결과이며 상품을 단정하지 않습니다.'}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={savedItemId ? '저장 해제' : '후보 저장'}
          accessibilityState={{ disabled: busy || !candidate.id }}
          disabled={busy || !candidate.id}
          className="rounded-full border border-kride px-3 py-2"
          onPress={toggleSaved}
        >
          <Text className="font-bold text-kride">{busy ? '처리 중…' : savedItemId ? '저장 해제' : '후보 저장'}</Text>
        </Pressable>
        {canOpen ? (
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(candidate.officialUrl!)}>
            <Text className="px-2 py-2 font-bold text-kride">권리 확인된 공식 출처</Text>
          </Pressable>
        ) : null}
      </View>
      {message ? <Text accessibilityRole="alert" className="text-sm text-rose-600">{message}</Text> : null}
    </View>
  );
};

const savedByProduct = (items: KpopSavedItem[]) => {
  const map = new Map<string, string | number>();
  items.forEach((item) => {
    if (item.itemType === 'PRODUCT_CANDIDATE') map.set(String(item.itemRef), item.id);
  });
  return map;
};

export const ProductSearchLeaf: React.FC<SduiLeafProps> = ({ data, apiBase = '' }) => {
  const [q, setQ] = useState(String(data?.q ?? ''));
  const artistId = String(data?.artistId ?? '');
  const eventId = String(data?.eventId ?? '');
  const [products, setProducts] = useState<KpopProductCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const runSearch = useCallback(async () => {
    setBusy(true);
    setMessage('상품 후보를 찾고 있어요.');
    try {
      const [rows, saved] = await Promise.all([
        searchKpopProductCandidates(apiBase, { q, artistId, eventId, limit: 30 }),
        getKpopSavedItems(apiBase).catch(() => []),
      ]);
      const ids = savedByProduct(saved);
      setProducts(rows.map((row) => ({
        ...row,
        savedItemId: row.savedItemId ?? ids.get(String(row.id)),
        isSaved: row.isSaved || ids.has(String(row.id)),
      })));
      setMessage(rows.length ? `${rows.length}개의 후보를 찾았습니다.` : '조건에 맞는 후보가 없습니다. 근거 부족은 정상적인 검색 결과입니다.');
    } catch (error) {
      setProducts([]);
      setMessage(errorCopy(error, '검색'));
    } finally {
      setBusy(false);
    }
  }, [apiBase, artistId, eventId, q]);

  useEffect(() => {
    void runSearch();
  }, []);

  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text className="text-2xl font-bold text-neutral-950">상품 후보 검색</Text>
        <Text className="text-sm leading-5 text-neutral-600">검색 결과는 후보이며 동일 상품·정품·구매 적합성을 보증하지 않습니다.</Text>
      </View>
      <TextInput accessibilityLabel="상품 키워드" value={q} onChangeText={setQ} placeholder="상품명 또는 브랜드" className="rounded-xl border border-neutral-300 px-4 py-3" />
      <Pressable accessibilityRole="button" accessibilityLabel="후보 검색" accessibilityState={{ disabled: busy }} disabled={busy} className="items-center rounded-full bg-kride px-4 py-3" onPress={() => void runSearch()}>
        <Text className="font-bold text-white">{busy ? '검색 중…' : '후보 검색'}</Text>
      </Pressable>
      {message ? <Text accessibilityRole="alert" className="text-sm text-neutral-600">{message}</Text> : null}
      <View className="gap-3">
        {products.map((candidate) => <ProductCandidateCardLeaf key={String(candidate.id)} candidate={candidate} apiBase={apiBase} />)}
      </View>
    </View>
  );
};

export const SavedItemListLeaf: React.FC<SduiLeafProps> = ({ apiBase = '' }) => {
  const [items, setItems] = useState<KpopSavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    getKpopSavedItems(apiBase)
      .then((rows) => {
        if (!mounted) return;
        setItems(rows);
        setMessage(rows.length ? '' : '저장한 항목이 없습니다.');
      })
      .catch((error) => {
        if (mounted) setMessage(errorCopy(error, '저장 목록을 확인'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [apiBase]);

  const products = useMemo(
    () => items.filter((item) => item.itemType === 'PRODUCT_CANDIDATE' && item.product),
    [items],
  );

  if (loading) return <Text>저장 목록을 불러오고 있어요.</Text>;

  return (
    <View className="gap-3">
      <Text className="text-2xl font-bold text-neutral-950">저장한 상품 후보</Text>
      {message ? <Text accessibilityRole="alert" className="text-sm text-neutral-600">{message}</Text> : null}
      {products.map((item) => (
        <ProductCandidateCardLeaf
          key={String(item.id)}
          candidate={{ ...item.product!, savedItemId: item.id, isSaved: true }}
          apiBase={apiBase}
          onRemoved={() => setItems((current) => current.filter((row) => row.id !== item.id))}
        />
      ))}
    </View>
  );
};
