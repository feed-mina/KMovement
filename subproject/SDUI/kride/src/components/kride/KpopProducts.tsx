'use client';

import { FormEvent, useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  canOpenKpopOfficialUrl,
  deleteKpopSavedItem,
  getKpopSavedItems,
  saveKpopProductCandidate,
  searchKpopProductCandidates,
  type KpopProductCandidate,
  type KpopSavedItem,
} from '@kride/core';
import KpopEvidenceBadge from '@/components/kride/KpopEvidenceBadge';

type LeafProps = {
  data?: Record<string, any>;
  apiBase?: string;
};

const errorCopy = (error: unknown, action = '요청') => {
  const message = error instanceof Error ? error.message : String(error);
  if (message === '401' || message.toLowerCase().includes('unauthorized')) {
    return `${action}하려면 로그인해 주세요.`;
  }
  if (message === '429' || message.toLowerCase().includes('too many requests')) {
    return '요청이 많습니다. 잠시 후 다시 시도해 주세요.';
  }
  return `${action}을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.`;
};

export const productGradeCopy = (grade?: string) => {
  switch (String(grade || '').toUpperCase()) {
    case 'EXACT_CANDIDATE':
      return '근거가 비교적 강한 후보 (동일 상품 확정 아님)';
    case 'SIMILAR':
      return '유사 후보';
    default:
      return '근거 부족 · 상품을 단정할 수 없음';
  }
};

export function ProductCandidateCard({
  candidate,
  apiBase = '',
  onRemoved,
}: {
  candidate: KpopProductCandidate;
  apiBase?: string;
  onRemoved?: (candidate: KpopProductCandidate) => void;
}) {
  const titleId = useId();
  const evidenceId = useId();
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
    <article className="kpop-result-candidate" role="listitem" aria-labelledby={titleId} aria-describedby={evidenceId}>
      <KpopEvidenceBadge id={evidenceId} grade={candidate.evidenceGrade} label={productGradeCopy(candidate.evidenceGrade)} />
      <h3 id={titleId}>{candidate.name || '이름이 확인되지 않은 상품 후보'}</h3>
      {candidate.brand ? <p>{candidate.brand}</p> : null}
      {typeof candidate.confidence === 'number' ? (
        <p className="kpop-evidence"><strong>모델 참고 점수:</strong> {Math.round(candidate.confidence)} / 100</p>
      ) : null}
      {candidate.evidenceText ? <p><strong>확인 근거:</strong> {candidate.evidenceText}</p> : (
        <p><strong>확인 근거:</strong> 제공되지 않았습니다. 근거 부족은 정상적인 결과이며 상품을 단정하지 않습니다.</p>
      )}
      <div className="kpop-result-actions">
        <button
          type="button"
          aria-pressed={Boolean(savedItemId)}
          aria-busy={busy}
          disabled={busy || !candidate.id}
          onClick={toggleSaved}
        >
          {busy ? '처리 중…' : savedItemId ? '저장 해제' : '후보 저장'}
        </button>
        {canOpen ? (
          <a href={candidate.officialUrl} target="_blank" rel="noreferrer">권리 확인된 공식 출처 <span>(새 창)</span></a>
        ) : null}
      </div>
      {message ? <p className="kpop-analysis-message" role="status" aria-live="polite" aria-atomic="true">{message}</p> : null}
    </article>
  );
}

const savedByProduct = (items: KpopSavedItem[]) => {
  const map = new Map<string, string | number>();
  items.forEach((item) => {
    if (item.itemType === 'PRODUCT_CANDIDATE') map.set(String(item.itemRef), item.id);
  });
  return map;
};

export function ProductSearch({ data, apiBase = '' }: LeafProps) {
  const helpId = useId();
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
  }, []); // Route query values are initial filters; subsequent searches are explicit.

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runSearch();
  };

  return (
    <section className="kpop-product-search" aria-labelledby="kpop-product-search-title">
      <h2 id="kpop-product-search-title">상품 후보 검색</h2>
      <p id={helpId}>검색 결과는 후보이며 동일 상품·정품·구매 적합성을 보증하지 않습니다.</p>
      <form className="kpop-product-filters" role="search" onSubmit={submitSearch}>
        <label>
          키워드
          <input
            type="search"
            aria-label="상품 키워드"
            aria-describedby={helpId}
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="상품명 또는 브랜드"
          />
        </label>
        <button type="submit" className="kpop-primary-btn" aria-busy={busy} disabled={busy}>
          {busy ? '검색 중…' : '후보 검색'}
        </button>
      </form>
      {message ? <p className="kpop-analysis-message" role="status" aria-live="polite" aria-atomic="true">{message}</p> : null}
      <div className="kpop-product-list" role="list" aria-label="상품 검색 후보" aria-busy={busy}>
        {products.map((candidate) => (
          <ProductCandidateCard key={String(candidate.id)} candidate={candidate} apiBase={apiBase} />
        ))}
      </div>
    </section>
  );
}

export function SavedItemList({ apiBase = '' }: LeafProps) {
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

  const productItems = useMemo(
    () => items.filter((item) => item.itemType === 'PRODUCT_CANDIDATE' && item.product),
    [items],
  );

  if (loading) return <p role="status" aria-live="polite">저장 목록을 불러오고 있어요.</p>;

  return (
    <section className="kpop-saved-list" aria-labelledby="kpop-saved-list-title">
      <h2 id="kpop-saved-list-title">저장한 상품 후보</h2>
      {message ? <p className="kpop-analysis-message" role="status" aria-live="polite" aria-atomic="true">{message}</p> : null}
      <div className="kpop-product-list" role="list" aria-label="저장한 상품 후보">
        {productItems.map((item) => (
          <ProductCandidateCard
            key={String(item.id)}
            candidate={{ ...item.product!, savedItemId: item.id, isSaved: true }}
            apiBase={apiBase}
            onRemoved={() => setItems((current) => current.filter((row) => row.id !== item.id))}
          />
        ))}
      </div>
    </section>
  );
}
